import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type SourceItem = {
	id?: string
	sourceName?: string
	title?: string
	link?: string
	topic?: string
	summary?: string
	prompt?: string
	publishedAt?: string
}

type Body = {
	sourceItem?: SourceItem
	level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
}

type ReaderParagraph = {
	italian: string
	english: string
}

type ReaderPayload = {
	id: string
	title: string
	sourceName: string
	sourceUrl: string
	publishedAt?: string
	level: string
	topic: string
	paragraphs: ReaderParagraph[]
	glossary: Array<{ italian: string; english: string }>
	discussionPrompt: string
	provider: 'openai' | 'fallback'
	sourceMaterial: 'article' | 'metadata'
	createdAt: string
}

const levelGuidance: Record<NonNullable<Body['level']>, string> = {
	A1: 'Use present tense, concrete words, and sentences of roughly 4-8 words.',
	A2: 'Use routine connectors, common modals or simple past chunks, and sentences of roughly 6-11 words.',
	B1: 'Use clear connected prose with common reasons, events, and opinions in sentences of roughly 8-14 words.',
	B2: 'Use natural qualification and consequences while keeping sentences easy to say aloud.',
	C1: 'Use precise, idiomatic adult language without academic jargon or unnecessarily long sentences.',
}

const readerSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		paragraphs: {
			type: 'array',
			minItems: 3,
			maxItems: 5,
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					italian: { type: 'string' },
					english: { type: 'string' },
				},
				required: ['italian', 'english'],
			},
		},
		glossary: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					italian: { type: 'string' },
					english: { type: 'string' },
				},
				required: ['italian', 'english'],
			},
		},
		discussionPrompt: { type: 'string' },
	},
	required: ['paragraphs', 'glossary', 'discussionPrompt'],
} as const

function outputText(data: any) {
	if (typeof data.output_text === 'string') return data.output_text
	const text = data.output
		?.flatMap((item: any) => item.content ?? [])
		?.find((content: any) => content.type === 'output_text')?.text
	return typeof text === 'string' ? text : ''
}

function clean(value: unknown, fallback = '') {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function cacheKey(sourceItem: SourceItem, level: string) {
	const id = clean(sourceItem.id, clean(sourceItem.link, clean(sourceItem.title, 'source')))
	const edition = clean(sourceItem.publishedAt, 'undated')
	return `readers-v3/${encodeURIComponent(level)}/${encodeURIComponent(
		`${id}-${edition}`
	)}`
}

const permittedArticleHosts = ['ansa.it', 'rainews.it']

function decodeHtml(value: string) {
	return value
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

function articlePlainText(value: string) {
	return decodeHtml(value)
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function collectJsonLdArticleText(value: unknown, bodies: string[], descriptions: string[]) {
	if (Array.isArray(value)) {
		value.forEach((item) => collectJsonLdArticleText(item, bodies, descriptions))
		return
	}
	if (!value || typeof value !== 'object') return
	const record = value as Record<string, unknown>
	if (typeof record.articleBody === 'string') bodies.push(record.articleBody)
	if (typeof record.body === 'string') bodies.push(record.body)
	if (typeof record.content === 'string') bodies.push(record.content)
	if (typeof record.description === 'string') descriptions.push(record.description)
	Object.values(record).forEach((item) => {
		if (item && typeof item === 'object') {
			collectJsonLdArticleText(item, bodies, descriptions)
		}
	})
}

function bestArticleText(bodies: string[], descriptions: string[]) {
	return (bodies.length ? bodies : descriptions)
		.map(articlePlainText)
		.filter((value, index, all) => value.length >= 80 && all.indexOf(value) === index)
		.join('\n\n')
		.slice(0, 7_500)
}

export function extractArticleJson(value: unknown) {
	const bodies: string[] = []
	const descriptions: string[] = []
	collectJsonLdArticleText(value, bodies, descriptions)
	return bestArticleText(bodies, descriptions)
}

function attribute(tag: string, name: string) {
	const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
	if (quoted) return quoted[2]
	return tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, 'i'))?.[1] ?? ''
}

export function extractArticleText(html: string) {
	const bodies: string[] = []
	const descriptions: string[] = []
	const scripts = html.match(
		/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
	) ?? []

	for (const script of scripts) {
		const raw = script
			.replace(/^<script\b[^>]*>/i, '')
			.replace(/<\/script>$/i, '')
			.trim()
		try {
			collectJsonLdArticleText(JSON.parse(raw), bodies, descriptions)
		} catch {}
	}

	if (!bodies.length) {
		const metaTags = html.match(/<meta\b[^>]*>/gi) ?? []
		for (const tag of metaTags) {
			const property = attribute(tag, 'property') || attribute(tag, 'name')
			if (!['og:description', 'description'].includes(property.toLowerCase())) continue
			const content = attribute(tag, 'content')
			if (content) descriptions.push(content)
		}
	}

	return bestArticleText(bodies, descriptions)
}

async function fetchArticleText(sourceItem: SourceItem) {
	const rawUrl = clean(sourceItem.link)
	if (!rawUrl) return ''
	let url: URL
	try {
		url = new URL(rawUrl)
	} catch {
		return ''
	}
	if (url.protocol !== 'https:') return ''
	if (
		!permittedArticleHosts.some(
			(host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
		)
	) {
		return ''
	}

	try {
		const response = await fetch(url, {
			headers: {
				Accept: 'text/html,application/xhtml+xml',
				'User-Agent': 'Olingo language reader/1.0',
			},
			signal: AbortSignal.timeout(8_000),
		})
		if (!response.ok) return ''
		const contentType = response.headers.get('content-type') ?? ''
		if (contentType.includes('json')) {
			try {
				return extractArticleJson(await response.json())
			} catch {
				return ''
			}
		}
		if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
			return extractArticleText(await response.text())
		}
		return ''
	} catch {
		return ''
	}
}

function fallbackReader(sourceItem: SourceItem, level: string) {
	const discussionPrompts: Record<string, string> = {
		A1: 'Questa notizia mi interessa perché...',
		A2: 'Ho letto questa notizia e penso che...',
		B1: 'Secondo me, questa notizia è importante perché...',
		B2: 'Il punto principale mi sembra valido, anche se...',
		C1: 'A mio avviso, la questione è più sfumata perché...',
	}
	return {
		paragraphs: [
			{
				italian: 'Questa notizia riguarda un tema attuale.',
				english: 'This news item concerns a current topic.',
			},
			{
				italian: 'Il titolo presenta il punto principale.',
				english: 'The headline presents the main point.',
			},
			{
				italian: 'Possiamo leggerla e poi dire la nostra opinione.',
				english:
					'We can read it and then give our opinion.',
			},
		],
		glossary: [
			{ italian: 'la notizia', english: 'the news item' },
			{ italian: 'secondo me', english: 'in my opinion' },
			{ italian: 'vale la pena', english: 'it is worth it' },
		],
		discussionPrompt:
			discussionPrompts[level] ?? 'Secondo me, questa notizia è interessante perché...',
	} satisfies Pick<ReaderPayload, 'paragraphs' | 'glossary' | 'discussionPrompt'>
}

async function generateReader(sourceItem: SourceItem, level: string, articleText: string) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) return null

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: getEnv('OPENAI_CONTENT_MODEL') || getEnv('OPENAI_MODEL') || 'gpt-5.4-mini',
			store: false,
			input: [
				{
					role: 'system',
					content:
						'Create a concise Italian learner newspaper adaptation. Preserve facts from the supplied source, but do not reproduce the article or imitate its wording. Write original, level-controlled prose. Pair every Italian paragraph with an accurate English translation. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						level,
						levelGuidance:
							levelGuidance[level as NonNullable<Body['level']>] ?? levelGuidance.B1,
						source: sourceItem,
						articleExtract: articleText || undefined,
						requirements: [
							'Write 3-5 short newspaper paragraphs at the requested level.',
							'Each Italian paragraph must have a clear English translation.',
							'Use the article extract when supplied so names, places, dates, numbers, and claims remain accurate.',
							'Do not invent a detail that is absent from the source material.',
							'Use original learner prose, never copied article sentences.',
							'Keep vocabulary, grammar, and sentence shape suitable for the requested level.',
							'At B2 and C1 increase precision, not obscurity or sentence length.',
							'Include 4-6 useful glossary items.',
							'End with one simple Italian discussion prompt.',
						],
					}),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_source_reader',
					strict: true,
					schema: readerSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		return JSON.parse(text) as Pick<
			ReaderPayload,
			'paragraphs' | 'glossary' | 'discussionPrompt'
		>
	} catch {
		return null
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body?.sourceItem?.title) {
		return json({ error: 'Missing source item' }, { status: 400 })
	}

	const level = body.level ?? 'B1'
	const store = getStore({ name: 'content-cache', consistency: 'strong' })
	const key = cacheKey(body.sourceItem, level)
	const cached = (await store.get(key, { type: 'json' })) as ReaderPayload | null
	if (cached) return json({ ...cached, cached: true })

	const articleText = await fetchArticleText(body.sourceItem)
	const generated = await generateReader(body.sourceItem, level, articleText)
	const reader = generated ?? fallbackReader(body.sourceItem, level)
	const payload: ReaderPayload = {
		id: key,
		title: clean(body.sourceItem.title, 'Italian source'),
		sourceName: clean(body.sourceItem.sourceName, 'Italian source'),
		sourceUrl: clean(body.sourceItem.link, '#'),
		publishedAt: clean(body.sourceItem.publishedAt) || undefined,
		level,
		topic: clean(body.sourceItem.topic, 'news'),
		...reader,
		provider: generated ? 'openai' : 'fallback',
		sourceMaterial: articleText ? 'article' : 'metadata',
		createdAt: new Date().toISOString(),
	}

	await store.setJSON(key, payload)
	return json({ ...payload, cached: false })
}

export const config = {
	path: '/api/source-reader',
}

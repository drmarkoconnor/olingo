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
	level: string
	topic: string
	paragraphs: ReaderParagraph[]
	glossary: Array<{ italian: string; english: string }>
	discussionPrompt: string
	provider: 'openai' | 'fallback'
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
	return `readers-v2/${encodeURIComponent(level)}/${encodeURIComponent(id)}`
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

async function generateReader(sourceItem: SourceItem, level: string) {
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
						'Create a short Italian learner reading from news metadata. Do not reproduce a full copyrighted article. Use simple, original prose based on the title and summary, with side-by-side English meaning. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						level,
						levelGuidance:
							levelGuidance[level as NonNullable<Body['level']>] ?? levelGuidance.B1,
						source: sourceItem,
						requirements: [
							'Write 3 short paragraphs at the requested level.',
							'Each Italian paragraph must have a clear English translation.',
							'Use original learner prose derived from metadata, not copied article text.',
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

	const generated = await generateReader(body.sourceItem, level)
	const reader = generated ?? fallbackReader(body.sourceItem, level)
	const payload: ReaderPayload = {
		id: key,
		title: clean(body.sourceItem.title, 'Italian source'),
		sourceName: clean(body.sourceItem.sourceName, 'Italian source'),
		sourceUrl: clean(body.sourceItem.link, '#'),
		level,
		topic: clean(body.sourceItem.topic, 'news'),
		...reader,
		provider: generated ? 'openai' : 'fallback',
		createdAt: new Date().toISOString(),
	}

	await store.setJSON(key, payload)
	return json({ ...payload, cached: false })
}

export const config = {
	path: '/api/source-reader',
}

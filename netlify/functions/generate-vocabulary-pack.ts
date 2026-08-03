import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
type VocabDomain =
	| 'food'
	| 'family'
	| 'sport'
	| 'cafe'
	| 'shopping'
	| 'travel'
	| 'home'
	| 'health'
	| 'culture'
	| 'local-news'
type PartOfSpeech =
	| 'noun'
	| 'verb'
	| 'chunk'
	| 'collocation'
	| 'adjective'
	| 'adverb'

type Body = {
	level?: CefrLevel
	programWeek?: number
	sessionFocus?: string
	stage?: unknown
	domains?: VocabDomain[]
	targetCount?: number
	avoidItalian?: string[]
	avoidEnglish?: string[]
}

type ContentHistory = {
	italian: string[]
	english: string[]
	updatedAt?: string
}

type GeneratedVocabulary = {
	italian: string
	english: string
	partOfSpeech: PartOfSpeech
	domain: VocabDomain
	level: CefrLevel
	utilityScore: number
}

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const domains: VocabDomain[] = [
	'food',
	'family',
	'sport',
	'cafe',
	'shopping',
	'travel',
	'home',
	'health',
	'culture',
	'local-news',
]
const partsOfSpeech: PartOfSpeech[] = [
	'noun',
	'verb',
	'chunk',
	'collocation',
	'adjective',
	'adverb',
]

const levelGuidance: Record<CefrLevel, string> = {
	A1: 'Concrete immediate needs, core actions, people, food, places, and very short ready-made requests.',
	A2: 'Routine actions, modals, time phrases, errands, simple past chunks, and ways to keep an exchange moving.',
	B1: 'Reasons, narration, plans, practical pronoun chunks, reactions, and ordinary group conversation.',
	B2: 'Qualification, consequence, tactful disagreement, repair, comparison, and hypothetical planning in common speech.',
	C1: 'Precise but common stance, reformulation, tact, distinctions, and limits on a claim without academic jargon.',
}

const vocabularySchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		items: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					italian: { type: 'string' },
					english: { type: 'string' },
					partOfSpeech: { type: 'string', enum: partsOfSpeech },
					domain: { type: 'string', enum: domains },
					level: { type: 'string', enum: levels },
					utilityScore: { type: 'number' },
				},
				required: [
					'italian',
					'english',
					'partOfSpeech',
					'domain',
					'level',
					'utilityScore',
				],
			},
		},
	},
	required: ['items'],
} as const

function outputText(data: any) {
	if (typeof data.output_text === 'string') return data.output_text
	const text = data.output
		?.flatMap((item: any) => item.content ?? [])
		?.find((content: any) => content.type === 'output_text')?.text
	return typeof text === 'string' ? text : ''
}

function normaliseLevel(value: unknown): CefrLevel {
	return levels.includes(value as CefrLevel) ? (value as CefrLevel) : 'B1'
}

function normaliseText(value: string) {
	return value
		.toLowerCase()
		.normalize('NFC')
		.replace(/[’']/g, ' ')
		.replace(/[.,!?;:()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function tokenSimilarity(a: string, b: string) {
	const aTokens = new Set(normaliseText(a).split(' ').filter(Boolean))
	const bTokens = new Set(normaliseText(b).split(' ').filter(Boolean))
	if (!aTokens.size || !bTokens.size) return 0
	let overlap = 0
	for (const token of aTokens) if (bTokens.has(token)) overlap += 1
	return overlap / Math.max(aTokens.size, bTokens.size)
}

function clampCount(value: unknown) {
	const count = Number(value)
	return Number.isFinite(count) ? Math.max(16, Math.min(36, Math.round(count))) : 24
}

function sanitize(
	items: GeneratedVocabulary[],
	level: CefrLevel,
	requestedDomains: VocabDomain[],
	avoidItalian: string[],
	avoidEnglish: string[],
	count: number
) {
	const seenItalian = [...avoidItalian]
	const seenEnglish = [...avoidEnglish]
	return items
		.filter(
			(item) =>
				item.level === level &&
				requestedDomains.includes(item.domain) &&
				item.italian?.trim() &&
				item.english?.trim()
		)
		.filter((item) => {
			const words = normaliseText(item.italian).split(' ').filter(Boolean).length
			if (words > 7 || item.utilityScore < 75) return false
			if (
				seenItalian.some(
					(existing) => tokenSimilarity(existing, item.italian) >= 0.9
				) ||
				seenEnglish.some(
					(existing) => tokenSimilarity(existing, item.english) >= 0.9
				)
			) {
				return false
			}
			seenItalian.push(item.italian)
			seenEnglish.push(item.english)
			return true
		})
		.map((item) => ({
			...item,
			utilityScore: Math.max(75, Math.min(100, Math.round(item.utilityScore))),
		}))
		.slice(0, count)
}

async function generate(
	body: Body,
	level: CefrLevel,
	requestedDomains: VocabDomain[],
	count: number
) {
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
						'Create high-utility Italian speech chunks and vocabulary for quick everyday production. This is a conversation trainer, not a dictionary or grammar syllabus. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						task: `Create exactly ${count} distinct Italian vocabulary items or spoken chunks.`,
						level,
						levelGuidance: levelGuidance[level],
						programWeek: body.programWeek,
						stage: body.stage,
						sessionFocus: body.sessionFocus ?? 'adaptive',
						domains: requestedDomains,
						avoidItalian: (body.avoidItalian ?? []).slice(-240),
						avoidEnglish: (body.avoidEnglish ?? []).slice(-240),
						requirements: [
							'Every item must be the exact requested CEFR level and belong to a requested domain.',
							'At least 60 percent must be verbs, collocations, or ready-to-say chunks rather than isolated nouns.',
							'Use natural modern spoken Italian with correct accents and apostrophes.',
							'Prefer language useful around food, family, sport, cafes, travel, home, health, culture, and ordinary local news.',
							'Keep Italian entries to seven words or fewer.',
							'At B2 and C1 increase precision and social usefulness, not rarity or length.',
							'Avoid surreal examples, rare trivia, formal jargon, near-synonym padding, and classroom-only grammar labels.',
							'Do not repeat or closely paraphrase either avoid list.',
						],
					}),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_vocabulary_pack',
					strict: true,
					schema: vocabularySchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		return (JSON.parse(text) as { items?: GeneratedVocabulary[] }).items ?? null
	} catch {
		return null
	}
}

function mergeHistory(current: string[], additions: string[]) {
	const seen = new Set<string>()
	const merged: string[] = []
	for (const value of [...current, ...additions]) {
		const key = normaliseText(value)
		if (!key || seen.has(key)) continue
		seen.add(key)
		merged.push(value)
	}
	return merged
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response
	const body = await readJson<Body>(req)
	if (!body) return json({ error: 'Missing vocabulary request' }, { status: 400 })

	const level = normaliseLevel(body.level)
	const historyStore = getStore({ name: 'content-history', consistency: 'strong' })
	const historyKey = `users/${encodeURIComponent(auth.user.id)}/vocabulary/history`
	const storedHistory = (await historyStore.get(historyKey, {
		type: 'json',
	})) as ContentHistory | null
	const history: ContentHistory = {
		italian: Array.isArray(storedHistory?.italian) ? storedHistory.italian : [],
		english: Array.isArray(storedHistory?.english) ? storedHistory.english : [],
	}
	if (!history.italian.length && !history.english.length) {
		try {
			const packStore = getStore({ name: 'generated-packs' })
			const prefix = `users/${encodeURIComponent(auth.user.id)}/vocabulary/`
			const { blobs } = await packStore.list({ prefix })
			const packs = (await Promise.all(
				blobs.map((blob) => packStore.get(blob.key, { type: 'json' }))
			)) as Array<{ items?: GeneratedVocabulary[] } | null>
			history.italian = mergeHistory(
				history.italian,
				packs.flatMap((pack) =>
					(pack?.items ?? []).map((item) => item.italian)
				)
			)
			history.english = mergeHistory(
				history.english,
				packs.flatMap((pack) =>
					(pack?.items ?? []).map((item) => item.english)
				)
			)
		} catch {
			// Continue with an empty history if the older pack library is unavailable.
		}
	}
	const generationBody: Body = {
		...body,
		avoidItalian: mergeHistory(history.italian, body.avoidItalian ?? []),
		avoidEnglish: mergeHistory(history.english, body.avoidEnglish ?? []),
	}
	const requestedDomains = Array.from(
		new Set((body.domains ?? []).filter((domain) => domains.includes(domain)))
	).slice(0, 5)
	if (!requestedDomains.length) requestedDomains.push('food', 'family', 'cafe')
	const count = clampCount(body.targetCount)
	const generated = await generate(generationBody, level, requestedDomains, count)
	const items = sanitize(
		generated ?? [],
		level,
		requestedDomains,
		generationBody.avoidItalian ?? [],
		generationBody.avoidEnglish ?? [],
		count
	)
	const provider = items.length ? 'openai' : 'fallback'
	const packId = `${new Date().toISOString()}-${level}-${Math.max(1, body.programWeek ?? 1)}`
	const payload = {
		packId,
		provider,
		level,
		programWeek: body.programWeek ?? null,
		domains: requestedDomains,
		items,
		createdAt: new Date().toISOString(),
	}
	await historyStore.setJSON(historyKey, {
		italian: mergeHistory(history.italian, items.map((item) => item.italian)),
		english: mergeHistory(history.english, items.map((item) => item.english)),
		updatedAt: new Date().toISOString(),
	})

	const store = getStore({ name: 'generated-packs', consistency: 'strong' })
	await store.setJSON(
		`users/${encodeURIComponent(auth.user.id)}/vocabulary/${encodeURIComponent(packId)}`,
		{ userId: auth.user.id, ...payload }
	)
	return json(payload)
}

export const config = {
	path: '/api/generate-vocabulary-pack',
}

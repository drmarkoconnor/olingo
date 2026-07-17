import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

type Body = {
	level?: CefrLevel
	programWeek?: number
	stage?: unknown
	activeTenseFocuses?: string[]
	targetCount?: number
	weakSounds?: string[]
	avoidTexts?: string[]
}

type Passage = {
	title: string
	level: CefrLevel
	text: string
	focus: string[]
	prepCue: string
	maxWords: number
	utilityScore: number
}

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const wordLimits: Record<CefrLevel, [number, number]> = {
	A1: [7, 14],
	A2: [10, 20],
	B1: [14, 26],
	B2: [16, 30],
	C1: [16, 32],
}

const levelGuidance: Record<CefrLevel, string> = {
	A1: 'One or two direct clauses about immediate needs, family, food, place, or routine.',
	A2: 'A short routine exchange using common modals, time phrases, or a simple past event.',
	B1: 'Two connected everyday ideas with a reason, event, plan, or practical pronoun.',
	B2: 'Natural qualification, consequence, repair, comparison, or hypothetical planning.',
	C1: 'Precise but conversational stance, reformulation, tact, or a carefully limited claim.',
}

const passageSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		passages: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					title: { type: 'string' },
					level: { type: 'string', enum: levels },
					text: { type: 'string' },
					focus: { type: 'array', items: { type: 'string' } },
					prepCue: { type: 'string' },
					maxWords: { type: 'number' },
					utilityScore: { type: 'number' },
				},
				required: [
					'title',
					'level',
					'text',
					'focus',
					'prepCue',
					'maxWords',
					'utilityScore',
				],
			},
		},
	},
	required: ['passages'],
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
		.replace(/[.,!?;:()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function wordCount(value: string) {
	return normaliseText(value).split(' ').filter(Boolean).length
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
	return Number.isFinite(count) ? Math.max(4, Math.min(10, Math.round(count))) : 6
}

function sanitize(passages: Passage[], level: CefrLevel, avoidTexts: string[], count: number) {
	const [minWords, maxWords] = wordLimits[level]
	const seen = [...avoidTexts]
	return passages
		.filter((passage) => passage.level === level && passage.title && passage.text)
		.filter((passage) => {
			const words = wordCount(passage.text)
			if (words < minWords || words > maxWords) return false
			if (passage.utilityScore < 75) return false
			if (seen.some((existing) => tokenSimilarity(existing, passage.text) >= 0.84)) {
				return false
			}
			seen.push(passage.text)
			return true
		})
		.map((passage) => ({
			...passage,
			focus: passage.focus.filter(Boolean).slice(0, 4),
			maxWords,
			utilityScore: Math.max(75, Math.min(100, Math.round(passage.utilityScore))),
		}))
		.slice(0, count)
}

async function generate(body: Body, level: CefrLevel, count: number) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) return null
	const [minWords, maxWords] = wordLimits[level]
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
						'Create short Italian read-aloud passages that improve confidence in practical conversation. They are speech practice, not grammar lessons. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						task: `Create exactly ${count} distinct Italian read-aloud passages.`,
						level,
						levelGuidance: levelGuidance[level],
						wordRange: [minWords, maxWords],
						programWeek: body.programWeek,
						stage: body.stage,
						activeTenseFocuses: body.activeTenseFocuses ?? [],
						weakSounds: body.weakSounds ?? [],
						avoidTexts: (body.avoidTexts ?? []).slice(-180),
						requirements: [
							'Use natural spoken Italian with correct accents and apostrophes.',
							'Use food, family, sport, cafes, travel, home, health, culture, or ordinary plans.',
							'Keep every passage within the exact word range.',
							'Use only tense focuses permitted by the current program week.',
							'At B2 and C1 increase pragmatic demand, not sentence length or obscurity.',
							'Avoid surreal, literary, political-jargon, textbook, and trivia sentences.',
							'Do not repeat or closely paraphrase avoidTexts.',
							'Give a brief English title and one practical English delivery cue.',
						],
					}),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_pronunciation_pack',
					strict: true,
					schema: passageSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		return (JSON.parse(text) as { passages?: Passage[] }).passages ?? null
	} catch {
		return null
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response
	const body = await readJson<Body>(req)
	if (!body) return json({ error: 'Missing pronunciation request' }, { status: 400 })

	const level = normaliseLevel(body.level)
	const count = clampCount(body.targetCount)
	const generated = await generate(body, level, count)
	const passages = sanitize(generated ?? [], level, body.avoidTexts ?? [], count)
	const provider = passages.length ? 'openai' : 'fallback'
	const packId = `${new Date().toISOString()}-${level}-${Math.max(1, body.programWeek ?? 1)}`
	const payload = {
		packId,
		provider,
		level,
		programWeek: body.programWeek ?? null,
		passages,
		createdAt: new Date().toISOString(),
	}

	const store = getStore({ name: 'generated-packs', consistency: 'strong' })
	await store.setJSON(
		`users/${encodeURIComponent(auth.user.id)}/pronunciation/${encodeURIComponent(packId)}`,
		{ userId: auth.user.id, ...payload }
	)
	return json(payload)
}

export const config = {
	path: '/api/generate-pronunciation-pack',
}

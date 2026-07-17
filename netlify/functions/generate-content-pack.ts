import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

type SourceItem = {
	id: string
	sourceName: string
	title: string
	link: string
	topic: string
	summary?: string
	prompt: string
}

type Body = {
	sourceItem?: SourceItem
	level?: CefrLevel
	programWeek?: number
}

type SourceExercise = {
	promptEnglish: string
	targetItalian: string
	phase: 'warmup' | 'produce' | 'speak'
	action: string
}

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const wordRanges: Record<CefrLevel, [number, number]> = {
	A1: [3, 7],
	A2: [4, 9],
	B1: [5, 10],
	B2: [5, 11],
	C1: [5, 12],
}

const sourcePackSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		exercises: {
			type: 'array',
			minItems: 3,
			maxItems: 3,
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					promptEnglish: { type: 'string' },
					targetItalian: { type: 'string' },
					phase: { type: 'string', enum: ['warmup', 'produce', 'speak'] },
					action: { type: 'string' },
				},
				required: ['promptEnglish', 'targetItalian', 'phase', 'action'],
			},
		},
	},
	required: ['exercises'],
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

function wordCount(value: string) {
	return value
		.trim()
		.replace(/[.,!?;:()]/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length
}

function keyFor(source: SourceItem, level: string) {
	return `source-v2/${encodeURIComponent(level)}/${encodeURIComponent(source.id)}`
}

export function fallbackExercises(level: CefrLevel): SourceExercise[] {
	const fallbacks: Record<CefrLevel, SourceExercise[]> = {
		A1: [
			{
				promptEnglish: 'This news is interesting.',
				targetItalian: 'Questa notizia è interessante.',
				phase: 'warmup',
				action: 'React',
			},
			{
				promptEnglish: 'I am reading this news today.',
				targetItalian: 'Leggo questa notizia oggi.',
				phase: 'produce',
				action: 'Summarise',
			},
			{
				promptEnglish: 'Do you like this news?',
				targetItalian: 'Ti piace questa notizia?',
				phase: 'speak',
				action: 'Ask view',
			},
		],
		A2: [
			{
				promptEnglish: 'I read this news today.',
				targetItalian: 'Ho letto questa notizia oggi.',
				phase: 'warmup',
				action: 'Summarise',
			},
			{
				promptEnglish: 'It seems useful to me.',
				targetItalian: 'Mi sembra una notizia utile.',
				phase: 'produce',
				action: 'React',
			},
			{
				promptEnglish: 'What do you think about it?',
				targetItalian: 'Che cosa ne pensi?',
				phase: 'speak',
				action: 'Ask view',
			},
		],
		B1: [
			{
				promptEnglish: 'I read this news and found it interesting.',
				targetItalian: "Ho letto questa notizia e l'ho trovata interessante.",
				phase: 'warmup',
				action: 'Summarise',
			},
			{
				promptEnglish: 'It matters because it affects everyday life.',
				targetItalian: 'È importante perché riguarda la vita quotidiana.',
				phase: 'produce',
				action: 'Give reason',
			},
			{
				promptEnglish: 'I am not sure I agree completely.',
				targetItalian: "Non sono sicuro di essere del tutto d'accordo.",
				phase: 'speak',
				action: 'Disagree softly',
			},
		],
		B2: [
			{
				promptEnglish: 'The main point seems clear enough.',
				targetItalian: 'Il punto principale mi sembra abbastanza chiaro.',
				phase: 'warmup',
				action: 'Summarise',
			},
			{
				promptEnglish: 'The consequences could affect many families.',
				targetItalian: 'Le conseguenze potrebbero riguardare molte famiglie.',
				phase: 'produce',
				action: 'Give consequence',
			},
			{
				promptEnglish: 'I see the point, but I have some doubts.',
				targetItalian: 'Capisco il punto, ma ho qualche dubbio.',
				phase: 'speak',
				action: 'Qualify',
			},
		],
		C1: [
			{
				promptEnglish: 'The issue is more nuanced than it appears.',
				targetItalian: 'La questione è più sfumata di quanto sembri.',
				phase: 'warmup',
				action: 'Qualify',
			},
			{
				promptEnglish: 'That said, the practical effect remains unclear.',
				targetItalian: "Detto questo, l'effetto pratico resta poco chiaro.",
				phase: 'produce',
				action: 'Limit claim',
			},
			{
				promptEnglish: 'In other words, we need more context.',
				targetItalian: 'In altre parole, ci serve più contesto.',
				phase: 'speak',
				action: 'Reformulate',
			},
		],
	}
	return fallbacks[level]
}

export function sanitizeSourceExercises(exercises: SourceExercise[], level: CefrLevel) {
	const [minWords, maxWords] = wordRanges[level]
	const seen = new Set<string>()
	return exercises
		.filter(
			(exercise) =>
				exercise.promptEnglish?.trim() &&
				exercise.targetItalian?.trim() &&
				wordCount(exercise.targetItalian) >= minWords &&
				wordCount(exercise.targetItalian) <= maxWords
		)
		.filter((exercise) => {
			const key = exercise.targetItalian.trim().toLowerCase()
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
		.slice(0, 3)
}

async function generate(source: SourceItem, level: CefrLevel, programWeek: number) {
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
						'Create three short, practical Italian speech drills from source metadata. These provide a light transfer break after core sentence practice, not a grammar lesson. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						level,
						programWeek,
						source: {
							title: source.title,
							summary: source.summary,
							topic: source.topic,
							prompt: source.prompt,
						},
						italianWordRange: wordRanges[level],
						requirements: [
							'Create one reaction, one useful statement, and one conversational follow-up.',
							'Use natural spoken Italian at exactly the requested CEFR level.',
							'Keep every Italian target within the word range.',
							'Use correct accents, apostrophes, pronouns, and agreement.',
							'Base meaning only on supplied metadata; do not invent facts or reproduce article prose.',
							'At B2 and C1 add precision or tact, not length or obscure vocabulary.',
						],
					}),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_source_drill_pack',
					strict: true,
					schema: sourcePackSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		return (JSON.parse(text) as { exercises?: SourceExercise[] }).exercises ?? null
	} catch {
		return null
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body?.sourceItem) return json({ error: 'Missing source item' }, { status: 400 })
	if ((body.programWeek ?? 1) < 17) {
		return json(
			{ error: 'Source-derived drills unlock in week 17', unlockWeek: 17 },
			{ status: 403 }
		)
	}

	const level = normaliseLevel(body.level)
	const store = getStore({ name: 'generated-packs', consistency: 'strong' })
	const key = keyFor(body.sourceItem, level)
	const cached = await store.get(key, { type: 'json' })
	if (cached) return json({ ...(cached as object), cached: true })

	const generated = await generate(body.sourceItem, level, body.programWeek ?? 17)
	const sanitized = sanitizeSourceExercises(generated ?? [], level)
	const exercises = sanitized.length === 3 ? sanitized : fallbackExercises(level)
	const payload = {
		id: `${level}-${body.sourceItem.id}`,
		title: body.sourceItem.title,
		level,
		sourceName: body.sourceItem.sourceName,
		sourceUrl: body.sourceItem.link,
		createdAt: new Date().toISOString(),
		provider: sanitized.length === 3 ? 'openai' : 'fallback',
		exercises,
	}
	await store.setJSON(key, payload)
	return json({ ...payload, cached: false })
}

export const config = {
	path: '/api/generate-content-pack',
}

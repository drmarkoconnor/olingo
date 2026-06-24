import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
type SentenceLength = 'short' | 'medium' | 'long'

type Body = {
	level?: CefrLevel
	programWeek?: number
	stage?: {
		title?: string
		goals?: string[]
		structures?: string[]
		verbs?: string[]
		topics?: string[]
		tags?: string[]
		phraseFamilies?: string[]
	}
	sceneId?: string
	sceneTitle?: string
	action?: string
	sentenceLength?: SentenceLength
	targetCount?: number
	weakTags?: string[]
	avoidItalian?: string[]
	avoidEnglish?: string[]
}

type GeneratedExercise = {
	promptEnglish: string
	targetItalian: string
	acceptedItalian: string[]
	hints: string[]
	tags: string[]
	phraseFamily: string
	phase: 'warmup' | 'produce' | 'repair' | 'speak'
	action: string
	communicativeGoal: string
	spokenCue: string
	repairPrompts: string[]
	keyVerb: string
	construction: string
	npcLine: string
}

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

const sentencePackSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		exercises: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					promptEnglish: { type: 'string' },
					targetItalian: { type: 'string' },
					acceptedItalian: { type: 'array', items: { type: 'string' } },
					hints: { type: 'array', items: { type: 'string' } },
					tags: { type: 'array', items: { type: 'string' } },
					phraseFamily: { type: 'string' },
					phase: {
						type: 'string',
						enum: ['warmup', 'produce', 'repair', 'speak'],
					},
					action: { type: 'string' },
					communicativeGoal: { type: 'string' },
					spokenCue: { type: 'string' },
					repairPrompts: { type: 'array', items: { type: 'string' } },
					keyVerb: { type: 'string' },
					construction: { type: 'string' },
					npcLine: { type: 'string' },
				},
				required: [
					'promptEnglish',
					'targetItalian',
					'acceptedItalian',
					'hints',
					'tags',
					'phraseFamily',
					'phase',
					'action',
					'communicativeGoal',
					'spokenCue',
					'repairPrompts',
					'keyVerb',
					'construction',
					'npcLine',
				],
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

function clampCount(value: unknown) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return 16
	return Math.max(8, Math.min(24, Math.round(parsed)))
}

function normaliseLevel(value: unknown): CefrLevel {
	return levels.includes(value as CefrLevel) ? (value as CefrLevel) : 'B1'
}

function normaliseLength(value: unknown): SentenceLength {
	return value === 'short' || value === 'long' ? value : 'medium'
}

function simpleHash(value: string) {
	let hash = 5381
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 33) ^ value.charCodeAt(index)
	}
	return (hash >>> 0).toString(36)
}

function normaliseSentence(value: string) {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFC')
		.replace(/[’']/g, ' ')
		.replace(/[.,!?;:()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function tokenSimilarity(a: string, b: string) {
	const aTokens = new Set(a.split(' ').filter(Boolean))
	const bTokens = new Set(b.split(' ').filter(Boolean))
	if (!aTokens.size || !bTokens.size) return 0
	let overlap = 0
	for (const token of aTokens) {
		if (bTokens.has(token)) overlap += 1
	}
	return overlap / Math.max(aTokens.size, bTokens.size)
}

function levelGuidance(level: CefrLevel) {
	if (level === 'A1') {
		return 'A1: present tense, essere/avere/fare, simple questions, family, routines, short direct sentences.'
	}
	if (level === 'A2') {
		return 'A2: modal + infinitive, everyday actions, simple passato prossimo, direct object pronouns only when practical.'
	}
	if (level === 'B2') {
		return 'B2: nuanced opinions, cause/consequence, hypothetical planning, concessions, but still natural spoken language.'
	}
	if (level === 'C1') {
		return 'C1: precise argument, subtle stance, concessive clauses, reformulation, natural adult register without literary obscurity.'
	}
	return 'B1: connected everyday sentences, opinions, past events, future plans, clear pronouns, simple connectors.'
}

function lengthGuidance(length: SentenceLength) {
	if (length === 'short') return '4-7 Italian words where possible.'
	if (length === 'long') return '12-22 Italian words, or up to 28 for B2/C1 only when natural.'
	return '8-12 Italian words where possible.'
}

function fallbackPack(body: Body, count: number): GeneratedExercise[] {
	const level = normaliseLevel(body.level)
	const stage = body.stage
	const verbs = stage?.verbs?.length ? stage.verbs : ['fare', 'dire', 'andare']
	const topics = stage?.topics?.length ? stage.topics : ['family', 'everyday life']
	const families = stage?.phraseFamilies?.length
		? stage.phraseFamilies
		: ['Generated sentence production']
	const situations = [
		{
			en: 'at dinner with my family',
			it: 'a cena con la mia famiglia',
			person: 'mia figlia',
			activity: 'preparare la pasta',
			place: 'in cucina',
			object: 'il tavolo',
		},
		{
			en: 'before the football match',
			it: 'prima della partita',
			person: 'mio fratello',
			activity: 'guardare la partita',
			place: 'al bar',
			object: 'i biglietti',
		},
		{
			en: 'during a coffee with friends',
			it: 'durante un caffe con amici',
			person: 'la mia amica',
			activity: 'prendere un caffe',
			place: 'in centro',
			object: 'il conto',
		},
		{
			en: 'after a family visit',
			it: 'dopo una visita in famiglia',
			person: 'mia madre',
			activity: 'fare una passeggiata',
			place: 'nel parco',
			object: 'la borsa',
		},
		{
			en: 'at a small cultural event',
			it: 'a un piccolo evento culturale',
			person: 'il gruppo',
			activity: 'ascoltare la musica',
			place: 'in piazza',
			object: 'il programma',
		},
		{
			en: 'while choosing food',
			it: 'mentre scegliamo da mangiare',
			person: 'il cameriere',
			activity: 'ordinare qualcosa',
			place: 'al ristorante',
			object: 'il menu',
		},
	]
	const templates = [
		(s: (typeof situations)[number]) => ({
			en: `I want to speak more calmly ${s.en}.`,
			it: `Voglio parlare con piu calma ${s.it}.`,
			construction: 'modal-infinitive',
		}),
		(s: (typeof situations)[number]) => ({
			en: `Can I help ${s.person} ${s.en}?`,
			it: `Posso aiutare ${s.person} ${s.it}?`,
			construction: 'modal-question',
		}),
		(s: (typeof situations)[number]) => ({
			en: `I have to ${s.activity} before we leave.`,
			it: `Devo ${s.activity} prima di partire.`,
			construction: 'dovere-infinitive',
		}),
		(s: (typeof situations)[number]) => ({
			en: `Yesterday I saw ${s.person} ${s.en}.`,
			it: `Ieri ho visto ${s.person} ${s.it}.`,
			construction: 'past-event',
		}),
		(s: (typeof situations)[number]) => ({
			en: `In my opinion, this is a good idea ${s.en}.`,
			it: `Secondo me, questa e una buona idea ${s.it}.`,
			construction: 'opinion-frame',
		}),
		(s: (typeof situations)[number]) => ({
			en: `Can you tell me where ${s.object} is?`,
			it: `Puoi dirmi dove si trova ${s.object}?`,
			construction: 'question-place',
		}),
		(s: (typeof situations)[number]) => ({
			en: `I do not understand what happened ${s.en}.`,
			it: `Non capisco che cosa e successo ${s.it}.`,
			construction: 'repair-question',
		}),
		(s: (typeof situations)[number]) => ({
			en: `We can talk about it later ${s.en}.`,
			it: `Possiamo parlarne piu tardi ${s.it}.`,
			construction: 'modal-pronoun',
		}),
		(s: (typeof situations)[number]) => ({
			en: `I brought ${s.object} because it was useful.`,
			it: `Ho portato ${s.object} perche era utile.`,
			construction: 'past-reason',
		}),
		(s: (typeof situations)[number]) => ({
			en: `I would like to understand the plan ${s.en}.`,
			it: `Vorrei capire il programma ${s.it}.`,
			construction: 'conditional-request',
		}),
	]

	return Array.from({ length: count }, (_, index) => {
		const situation = situations[index % situations.length]
		const base = templates[index % templates.length](situation)
		const verb = verbs[index % verbs.length]
		const topic = topics[index % topics.length]
		const phraseFamily = families[index % families.length]
		return {
			promptEnglish: `${base.en} Use it in a ${topic} conversation.`,
			targetItalian: base.it,
			acceptedItalian: [base.it],
			hints: [`Use ${verb} as your anchor verb.`, `Focus: ${base.construction}.`],
			tags: [level.toLowerCase(), 'generated', base.construction],
			phraseFamily,
			phase: 'produce',
			action: body.action || 'Build',
			communicativeGoal: 'Say the idea quickly enough for conversation.',
			spokenCue: 'Say it once roughly, then type the version you meant.',
			repairPrompts: [base.en, `Change one detail: ${base.en}`],
			keyVerb: verb,
			construction: base.construction,
			npcLine: '',
		}
	})
}

function sanitizeExercises(exercises: GeneratedExercise[], count: number) {
	const seen = new Set<string>()
	const seenItalian: string[] = []
	const seenEnglish: string[] = []
	return exercises
		.filter((exercise) => exercise.promptEnglish && exercise.targetItalian)
		.filter((exercise) => {
			const english = normaliseSentence(exercise.promptEnglish)
			const italian = normaliseSentence(exercise.targetItalian)
			const key = `${english}::${italian}`
			if (seen.has(key)) return false
			if (
				seenItalian.some((item) => tokenSimilarity(italian, item) >= 0.9) ||
				seenEnglish.some((item) => tokenSimilarity(english, item) >= 0.9)
			) {
				return false
			}
			seen.add(key)
			seenItalian.push(italian)
			seenEnglish.push(english)
			return true
		})
		.map((exercise) => ({
			...exercise,
			acceptedItalian: exercise.acceptedItalian.length
				? exercise.acceptedItalian
				: [exercise.targetItalian],
			hints: exercise.hints.slice(0, 3),
			tags: exercise.tags.slice(0, 8),
			repairPrompts: exercise.repairPrompts.length
				? exercise.repairPrompts.slice(0, 3)
				: [exercise.promptEnglish],
		}))
		.slice(0, count)
}

async function generateWithOpenAI(body: Body, count: number) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) return null
	const level = normaliseLevel(body.level)
	const sentenceLength = normaliseLength(body.sentenceLength)
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
						'You generate Italian sentence-production drills for one learner. Return only schema-valid JSON. Create fresh, natural, spoken Italian prompts, not a finite stock list.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						task: `Generate exactly ${count} unique English-to-Italian production drills.`,
						level,
						levelGuidance: levelGuidance(level),
						sentenceLength,
						lengthGuidance: lengthGuidance(sentenceLength),
						stage: body.stage,
						scene: {
							id: body.sceneId,
							title: body.sceneTitle,
							action: body.action,
						},
						weakTags: body.weakTags ?? [],
						requirements: [
							'Do not repeat avoidItalian or avoidEnglish.',
							'Do not produce near-duplicates inside this pack.',
							'Every promptEnglish should be a clear British English communicative intent.',
							'Every targetItalian should be a natural sentence the learner could say aloud.',
							'Prefer everyday/family/adult conversation unless stage topics explicitly widen the field.',
							'Keep grammar systematic: vary vocabulary, but reuse the current construction enough to build speed.',
							'Reward spoken adequacy: sentences should be usable before they are elegant.',
						],
						avoidItalian: (body.avoidItalian ?? []).slice(-180),
						avoidEnglish: (body.avoidEnglish ?? []).slice(-180),
					}),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_sentence_pack',
					strict: true,
					schema: sentencePackSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		const parsed = JSON.parse(text) as { exercises?: GeneratedExercise[] }
		return parsed.exercises ?? null
	} catch {
		return null
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body) return json({ error: 'Missing generation request' }, { status: 400 })
	const count = clampCount(body.targetCount)
	const packId = `${new Date().toISOString()}-${simpleHash(
		JSON.stringify({
			level: body.level,
			programWeek: body.programWeek,
			action: body.action,
			sceneId: body.sceneId,
		})
	)}`

	const ai = await generateWithOpenAI(body, count)
	const exercises = sanitizeExercises(ai ?? fallbackPack(body, count), count)
	const provider = ai ? 'openai' : 'fallback'

	const payload = {
		packId,
		provider,
		level: normaliseLevel(body.level),
		programWeek: body.programWeek ?? null,
		exercises,
		createdAt: new Date().toISOString(),
	}

	const store = getStore({ name: 'generated-packs', consistency: 'strong' })
	await store.setJSON(
		`users/${encodeURIComponent(auth.user.id)}/sentences/${encodeURIComponent(packId)}`,
		{
			userId: auth.user.id,
			...payload,
		}
	)

	return json(payload)
}

export const config = {
	path: '/api/generate-sentence-pack',
}

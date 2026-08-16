import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
type DrillFamilyId =
	| 'doing-making'
	| 'modal-engine'
	| 'movement'
	| 'giving'
	| 'speaking'
	| 'taking-placing'
	| 'experiencer-patterns'
	| 'reflexive-routines'
type DrillFocus =
	| 'guided'
	| 'forms'
	| 'polarity'
	| 'pronouns'
	| 'time-shifts'
	| 'conversation'
type DrillStage =
	| 'meet'
	| 'retrieve'
	| 'switch'
	| 'polarity'
	| 'pronoun'
	| 'time'
	| 'conversation'
type TenseFocus =
	| 'present'
	| 'modal-infinitive'
	| 'imperative'
	| 'passato-prossimo'
	| 'imperfect'
	| 'future'
	| 'conditional'
	| 'subjunctive-chunk'
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
type CommunicativeFunction =
	| 'request'
	| 'offer'
	| 'ask-back'
	| 'refuse-politely'
	| 'give-reason'
	| 'repair'
	| 'locate'
	| 'plan'
	| 'narrate'
	| 'react'

type Body = {
	familyId?: DrillFamilyId
	level?: CefrLevel
	focus?: DrillFocus
	targetCount?: number
	stagePlan?: DrillStage[]
	avoidItalian?: string[]
	avoidEnglish?: string[]
}

type GeneratedDrill = {
	stage: DrillStage
	instruction: string
	promptEnglish: string
	targetItalian: string
	acceptedItalian: string[]
	hints: string[]
	npcLine: string
	keyVerb: string
	tenseFocus: TenseFocus
	vocabDomain: VocabDomain
	communicativeFunction: CommunicativeFunction
	maxWords: number
	utilityScore: number
}

type DrillHistory = {
	italian: string[]
	english: string[]
	updatedAt?: string
}

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const focuses: DrillFocus[] = [
	'guided',
	'forms',
	'polarity',
	'pronouns',
	'time-shifts',
	'conversation',
]
const stages: DrillStage[] = [
	'meet',
	'retrieve',
	'switch',
	'polarity',
	'pronoun',
	'time',
	'conversation',
]
const tenseFocuses: TenseFocus[] = [
	'present',
	'modal-infinitive',
	'imperative',
	'passato-prossimo',
	'imperfect',
	'future',
	'conditional',
	'subjunctive-chunk',
]
const vocabDomains: VocabDomain[] = [
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
const communicativeFunctions: CommunicativeFunction[] = [
	'request',
	'offer',
	'ask-back',
	'refuse-politely',
	'give-reason',
	'repair',
	'locate',
	'plan',
	'narrate',
	'react',
]

const families: Record<
	DrillFamilyId,
	{
		label: string
		anchors: string[]
		contrasts: string[]
		domains: VocabDomain[]
	}
> = {
	'doing-making': {
		label: 'Doing, making, and sorting things out',
		anchors: ['fare', 'preparare', 'sistemare', 'cambiare'],
		contrasts: ['broad action', 'preparing', 'putting something right'],
		domains: ['home', 'food', 'family'],
	},
	'modal-engine': {
		label: 'Wanting, being able, and having to',
		anchors: ['volere', 'potere', 'dovere', 'riuscire'],
		contrasts: ['desire', 'possibility', 'obligation', 'successful completion'],
		domains: ['family', 'food', 'travel'],
	},
	movement: {
		label: 'Going, coming, leaving, and returning',
		anchors: ['andare', 'venire', 'partire', 'tornare'],
		contrasts: ['movement away', 'movement towards', 'leaving', 'returning'],
		domains: ['travel', 'family', 'cafe'],
	},
	giving: {
		label: 'Giving, passing, carrying, and returning',
		anchors: ['dare', 'passare', 'portare', 'restituire'],
		contrasts: ['the thing', 'the recipient', 'clear nouns before pronouns'],
		domains: ['food', 'family', 'home'],
	},
	speaking: {
		label: 'Saying, asking, answering, and explaining',
		anchors: ['dire', 'chiedere', 'rispondere', 'spiegare', 'raccontare'],
		contrasts: ['a message', 'a request', 'an answer', 'a developed story'],
		domains: ['family', 'culture', 'travel'],
	},
	'taking-placing': {
		label: 'Taking, putting, holding, and leaving',
		anchors: ['prendere', 'mettere', 'tenere', 'lasciare'],
		contrasts: ['taking', 'placing', 'holding', 'leaving an object'],
		domains: ['home', 'travel', 'food'],
	},
	'experiencer-patterns': {
		label: 'Liking, missing, needing, and seeming',
		anchors: ['piacere', 'mancare', 'servire', 'sembrare'],
		contrasts: ['one thing versus several', 'the person expressed by a pronoun'],
		domains: ['food', 'family', 'culture'],
	},
	'reflexive-routines': {
		label: 'Getting ready, feeling, and remembering',
		anchors: ['alzarsi', 'vestirsi', 'sentirsi', 'ricordarsi', 'divertirsi'],
		contrasts: ['pronoun and verb as one unit', 'change the person', 'past agreement'],
		domains: ['home', 'health', 'family'],
	},
}

const familyIds = Object.keys(families) as DrillFamilyId[]

const drillSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		prompts: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					stage: { type: 'string', enum: stages },
					instruction: { type: 'string' },
					promptEnglish: { type: 'string' },
					targetItalian: { type: 'string' },
					acceptedItalian: { type: 'array', items: { type: 'string' } },
					hints: { type: 'array', items: { type: 'string' } },
					npcLine: { type: 'string' },
					keyVerb: { type: 'string' },
					tenseFocus: { type: 'string', enum: tenseFocuses },
					vocabDomain: { type: 'string', enum: vocabDomains },
					communicativeFunction: {
						type: 'string',
						enum: communicativeFunctions,
					},
					maxWords: { type: 'number' },
					utilityScore: { type: 'number' },
				},
				required: [
					'stage',
					'instruction',
					'promptEnglish',
					'targetItalian',
					'acceptedItalian',
					'hints',
					'npcLine',
					'keyVerb',
					'tenseFocus',
					'vocabDomain',
					'communicativeFunction',
					'maxWords',
					'utilityScore',
				],
			},
		},
	},
	required: ['prompts'],
} as const

const validationSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		reviews: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					index: { type: 'number' },
					valid: { type: 'boolean' },
					reason: { type: 'string' },
				},
				required: ['index', 'valid', 'reason'],
			},
		},
	},
	required: ['reviews'],
} as const

function outputText(data: any) {
	if (typeof data.output_text === 'string') return data.output_text
	const text = data.output
		?.flatMap((item: any) => item.content ?? [])
		?.find((content: any) => content.type === 'output_text')?.text
	return typeof text === 'string' ? text : ''
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

function wordCount(value: string) {
	return value
		.replace(/[.,!?;:()]/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length
}

function simpleHash(value: string) {
	let hash = 5381
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 33) ^ value.charCodeAt(index)
	}
	return (hash >>> 0).toString(36)
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

function clampCount(value: unknown) {
	const count = Number(value)
	return Number.isFinite(count) ? Math.max(20, Math.min(30, Math.round(count))) : 20
}

function normaliseLevel(value: unknown): CefrLevel {
	return levels.includes(value as CefrLevel) ? (value as CefrLevel) : 'B1'
}

function normaliseFocus(value: unknown): DrillFocus {
	return focuses.includes(value as DrillFocus) ? (value as DrillFocus) : 'guided'
}

function normaliseFamily(value: unknown): DrillFamilyId {
	return familyIds.includes(value as DrillFamilyId)
		? (value as DrillFamilyId)
		: 'modal-engine'
}

function levelGuidance(level: CefrLevel) {
	if (level === 'A1') return 'Present tense, familiar nouns, and one operation at a time.'
	if (level === 'A2') return 'Everyday modals, practical pronouns, and simple completed past forms.'
	if (level === 'B1') return 'Independent short replies, useful tense changes, and common pronoun combinations.'
	if (level === 'B2') return 'Greater pragmatic precision and flexible transformations, without longer sentences.'
	return 'Natural adult precision, register control, and rapid reformulation, without literary obscurity.'
}

async function callOpenAI(input: unknown, schema: unknown, schemaName: string) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) return null
	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model:
				getEnv('OPENAI_CONTENT_MODEL') ||
				getEnv('OPENAI_MODEL') ||
				'gpt-5.4-mini',
			store: false,
			input,
			text: {
				format: {
					type: 'json_schema',
					name: schemaName,
					strict: true,
					schema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const text = outputText(await response.json())
	if (!text) return null
	try {
		return JSON.parse(text) as Record<string, unknown>
	} catch {
		return null
	}
}

async function generatePrompts(args: {
	familyId: DrillFamilyId
	level: CefrLevel
	focus: DrillFocus
	count: number
	stagePlan: DrillStage[]
	avoidItalian: string[]
	avoidEnglish: string[]
}) {
	const family = families[args.familyId]
	return callOpenAI(
		[
			{
				role: 'system',
				content:
					'Create a compact Italian speaking ladder. It must train rapid retrieval of short, useful speech, not grammar explanation. Build patterned variety: hold one frame steady while changing a person, object, polarity, or time cue. Return only schema-valid JSON.',
			},
			{
				role: 'user',
				content: JSON.stringify({
					task: `Create exactly ${args.count} prompts in the supplied stage order.`,
					level: args.level,
					levelGuidance: levelGuidance(args.level),
					focus: args.focus,
					family,
					stagePlan: args.stagePlan,
					requirements: [
						'Use the stagePlan in exactly this order, with one output item per entry.',
						'Every English cue must be a precise translation of the Italian target, including person, tense, pronouns, and time.',
						'Use natural modern spoken Italian with correct accents and apostrophes.',
						'Keep each target to 4-10 Italian words; allow 12 only when essential at B1-C1.',
						'Use common adult situations involving food, family, sport, cafes, shopping, travel, home, health, or culture.',
						'Do not use surreal, abstract, literary, childish, or classroom-only sentences.',
						'A higher CEFR level means less support and more flexible operations, not rarer vocabulary or longer targets.',
						'Meet: provide a useful anchor. Retrieve: preserve its frame. Switch: change one person or concrete detail. Polarity: question or negate it. Pronoun: show the clear noun meaning in English but require the useful Italian pronoun. Time: move the same practical meaning through spoken-core tenses. Conversation: include a short Italian npcLine that makes the requested reply unambiguous.',
						'For giving and speaking families, establish the thing and recipient with clear nouns before using combined pronouns.',
						'For piacere-like verbs, make the grammatical number and experiencer unmistakable in English.',
						'For reflexive verbs, keep reflexive person and past agreement accurate.',
						'Do not repeat any item in avoidItalian or avoidEnglish exactly.',
						'acceptedItalian may contain natural equivalents only when they preserve the exact cue.',
						'Hints must direct attention to one useful contrast without revealing the entire target.',
						'utilityScore must be 80-100.',
					],
					avoidItalian: args.avoidItalian.slice(-700),
					avoidEnglish: args.avoidEnglish.slice(-700),
				}),
			},
		],
		drillSchema,
		'italian_drill_ladder'
	)
}

function sanitizePrompts(
	items: GeneratedDrill[],
	args: {
		level: CefrLevel
		count: number
		stagePlan: DrillStage[]
		avoidItalian: string[]
		avoidEnglish: string[]
	}
) {
	const seenItalian = new Set(args.avoidItalian.map(normaliseText))
	const seenEnglish = new Set(args.avoidEnglish.map(normaliseText))
	const maxAllowed = args.level === 'A1' || args.level === 'A2' ? 10 : 12
	const accepted: GeneratedDrill[] = []
	for (let index = 0; index < items.length && accepted.length < args.count; index += 1) {
		const item = items[index]
		const expectedStage = args.stagePlan[accepted.length]
		const italian = normaliseText(item?.targetItalian ?? '')
		const english = normaliseText(item?.promptEnglish ?? '')
		if (!item || item.stage !== expectedStage || !italian || !english) continue
		if (seenItalian.has(italian) || seenEnglish.has(english)) continue
		if (!tenseFocuses.includes(item.tenseFocus)) continue
		if (!vocabDomains.includes(item.vocabDomain)) continue
		if (!communicativeFunctions.includes(item.communicativeFunction)) continue
		if (wordCount(item.targetItalian) > maxAllowed) continue
		if (Number(item.utilityScore) < 80) continue
		seenItalian.add(italian)
		seenEnglish.add(english)
		accepted.push({
			...item,
			acceptedItalian: Array.from(
				new Set([item.targetItalian, ...(item.acceptedItalian ?? [])])
			).slice(0, 5),
			hints: (item.hints ?? []).filter(Boolean).slice(0, 2),
			maxWords: Math.max(
				wordCount(item.targetItalian),
				Math.min(maxAllowed, Math.round(Number(item.maxWords) || maxAllowed))
			),
			utilityScore: Math.max(80, Math.min(100, Math.round(item.utilityScore))),
		})
	}
	return accepted
}

async function validatePrompts(
	level: CefrLevel,
	familyId: DrillFamilyId,
	prompts: GeneratedDrill[]
) {
	if (!prompts.length) return []
	const result = await callOpenAI(
		[
			{
				role: 'system',
				content:
					'Independently audit Italian speaking drills. Reject rather than silently repair. Check exact bilingual meaning, natural modern Italian, pronoun reference, tense, agreement, conversational coherence, CEFR fit, and practical usefulness. Return only schema-valid JSON.',
			},
			{
				role: 'user',
				content: JSON.stringify({
					level,
					family: families[familyId],
					prompts: prompts.map((prompt, index) => ({ index, ...prompt })),
				}),
			},
		],
		validationSchema,
		'italian_drill_validation'
	)
	if (!result) return prompts
	const reviews = Array.isArray(result.reviews)
		? (result.reviews as Array<{ index?: number; valid?: boolean }>)
		: []
	const validIndexes = new Set(
		reviews
			.filter((review) => review.valid && Number.isInteger(review.index))
			.map((review) => Number(review.index))
	)
	return prompts.filter((_, index) => validIndexes.has(index))
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response
	const body = await readJson<Body>(req)
	if (!body) return json({ error: 'Missing drill request' }, { status: 400 })

	const familyId = normaliseFamily(body.familyId)
	const level = normaliseLevel(body.level)
	const focus = normaliseFocus(body.focus)
	const count = clampCount(body.targetCount)
	const suppliedPlan = (body.stagePlan ?? []).filter((stage) => stages.includes(stage))
	if (suppliedPlan.length !== count) {
		return json({ error: 'The drill stage plan is incomplete.' }, { status: 400 })
	}

	const historyStore = getStore({ name: 'content-history', consistency: 'strong' })
	const historyKey = `users/${encodeURIComponent(
		auth.user.id
	)}/drills/${familyId}/history`
	const stored = (await historyStore.get(historyKey, {
		type: 'json',
	})) as DrillHistory | null
	const history: DrillHistory = {
		italian: Array.isArray(stored?.italian) ? stored.italian : [],
		english: Array.isArray(stored?.english) ? stored.english : [],
	}
	const avoidItalian = mergeHistory(history.italian, body.avoidItalian ?? [])
	const avoidEnglish = mergeHistory(history.english, body.avoidEnglish ?? [])
	const generated = await generatePrompts({
		familyId,
		level,
		focus,
		count,
		stagePlan: suppliedPlan,
		avoidItalian,
		avoidEnglish,
	})
	const rawPrompts = Array.isArray(generated?.prompts)
		? (generated?.prompts as GeneratedDrill[])
		: []
	const sanitized = sanitizePrompts(rawPrompts, {
		level,
		count,
		stagePlan: suppliedPlan,
		avoidItalian,
		avoidEnglish,
	})
	const prompts = await validatePrompts(level, familyId, sanitized)
	const provider = prompts.length === count ? 'openai' : 'fallback'
	const createdAt = new Date().toISOString()
	const packId = `${createdAt}-${simpleHash(
		JSON.stringify({ familyId, level, focus, first: prompts[0]?.targetItalian })
	)}`
	const payload = {
		packId,
		provider,
		familyId,
		level,
		focus,
		targetCount: count,
		prompts: provider === 'openai' ? prompts : [],
		createdAt,
	}

	if (prompts.length) {
		await historyStore.setJSON(historyKey, {
			// Keep a generous recent generation window; every complete pack remains in
			// generated-packs, so older learner content is never discarded.
			italian: mergeHistory(history.italian, prompts.map((item) => item.targetItalian)).slice(
				-2000
			),
			english: mergeHistory(history.english, prompts.map((item) => item.promptEnglish)).slice(
				-2000
			),
			updatedAt: createdAt,
		})
		const packStore = getStore({ name: 'generated-packs', consistency: 'strong' })
		await packStore.setJSON(
			`users/${encodeURIComponent(auth.user.id)}/drills/${familyId}/${encodeURIComponent(
				packId
			)}`,
			{ userId: auth.user.id, ...payload }
		)
	}

	return json(payload)
}

export const config = {
	path: '/api/generate-drill-ladder',
}

import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
type SentenceLength = 'short' | 'medium' | 'long'
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

type ConversationFramePayload = {
	id: string
	label: string
	communicativeFunction: CommunicativeFunction
	tenseFocus: TenseFocus
	vocabDomain: VocabDomain
	maxWords: number
	utilityScore: number
	seedEnglish: string
	seedItalian: string
	slotHints: string[]
	tags: string[]
	cefrLevel: CefrLevel
}

type Body = {
	level?: CefrLevel
	programWeek?: number
	sessionFocus?: string
	sessionFocusLabel?: string
	sessionDomain?: 'mixed' | VocabDomain
	challengeMode?: string
	stage?: {
		title?: string
		goals?: string[]
		structures?: string[]
		verbs?: string[]
		topics?: string[]
		tags?: string[]
		phraseFamilies?: string[]
		tenseFocuses?: TenseFocus[]
	}
	activeTenseFocuses?: TenseFocus[]
	recognitionOnlyTenses?: string[]
	conversationFrames?: ConversationFramePayload[]
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
	frameId: string
	tenseFocus: TenseFocus
	vocabDomain: VocabDomain
	communicativeFunction: CommunicativeFunction
	maxWords: number
	utilityScore: number
	cefrLevel: CefrLevel
}

const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const contentVersion = 2

const actionByFunction: Record<CommunicativeFunction, string> = {
	request: 'Ask for something',
	offer: 'Offer help',
	'ask-back': 'Ask a follow-up',
	'refuse-politely': 'Refuse politely',
	'give-reason': 'Give a reason',
	repair: 'Ask for clarification',
	locate: 'Find or locate something',
	plan: 'Make a plan',
	narrate: 'Tell what happened',
	react: 'React naturally',
}

function actionForFunction(value: CommunicativeFunction) {
	return actionByFunction[value]
}

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
					frameId: { type: 'string' },
					tenseFocus: {
						type: 'string',
						enum: [
							'present',
							'modal-infinitive',
							'imperative',
							'passato-prossimo',
							'imperfect',
							'future',
							'conditional',
							'subjunctive-chunk',
						],
					},
					vocabDomain: {
						type: 'string',
						enum: [
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
						],
					},
					communicativeFunction: {
						type: 'string',
						enum: [
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
						],
					},
					maxWords: { type: 'number' },
					utilityScore: { type: 'number' },
					cefrLevel: { type: 'string', enum: levels },
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
					'frameId',
					'tenseFocus',
					'vocabDomain',
					'communicativeFunction',
					'maxWords',
					'utilityScore',
					'cefrLevel',
				],
			},
		},
	},
	required: ['exercises'],
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

type ContentHistory = {
	italian: string[]
	english: string[]
	updatedAt?: string
}

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

function wordCount(value: string) {
	return value
		.replace(/[.,!?;:()]/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length
}

function defaultMaxWordsFor(level: CefrLevel, length: SentenceLength) {
	if (length === 'short') return 7
	if (length === 'long' && (level === 'B1' || level === 'B2' || level === 'C1')) {
		return 12
	}
	return 10
}

function clampMaxWords(value: unknown, fallback: number) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return fallback
	return Math.max(4, Math.min(12, Math.round(parsed)))
}

function clampUtilityScore(value: unknown, fallback: number) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return fallback
	return Math.max(0, Math.min(100, Math.round(parsed)))
}

function hasNearDuplicate(value: string, existing: string[]) {
	return existing.some((item) => tokenSimilarity(value, item) >= 0.9)
}

function isBannedSentence(value: string) {
	const banned = [
		'armadillo',
		'purple',
		'insect',
		'insects',
		'breeding',
		'mountain',
		'mountains',
		'dragon',
		'wizard',
		'spaceship',
		'quantum',
		'theorem',
		'constant weight',
	]
	const normalised = normaliseSentence(value)
	return banned.some((term) => normalised.includes(term))
}

const leakedGeneratorInstruction = /\buse it in a\b.+\bconversation\b/i
const italianLeakInEnglish = /\b(prendere|partire|preparare|guardare|ascoltare|ordinare|pagato|pagare|caffe|caffè|perche|piu|binario|uscire|venire|andare|fare una|fare la|dirmi|parlarne)\b/i

function promptIsCleanEnglish(promptEnglish: string) {
	const prompt = promptEnglish.trim()
	if (!prompt) return false
	if (leakedGeneratorInstruction.test(prompt)) return false
	if (italianLeakInEnglish.test(prompt)) return false
	return true
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
	if (length === 'long') return '10-12 Italian words, only when the frame needs a connected B1/B2 turn.'
	return '4-10 Italian words where possible.'
}

function fallbackPack(body: Body, count: number): GeneratedExercise[] {
	const level = normaliseLevel(body.level)
	const frames = (body.conversationFrames ?? []).filter(
		(frame) => frame.utilityScore >= 70 && frame.maxWords <= 12
	)
	if (frames.length) {
		return frames.slice(0, count).map((frame) => {
			const maxWords = clampMaxWords(
				frame.maxWords,
				defaultMaxWordsFor(level, 'medium')
			)
			return {
				promptEnglish: frame.seedEnglish,
				targetItalian: frame.seedItalian,
				acceptedItalian: [frame.seedItalian],
				hints: [
					`Frame: ${frame.label}.`,
					`Keep it short: ${frame.maxWords} words or fewer.`,
				],
				tags: [
					level.toLowerCase(),
					'generated',
					frame.tenseFocus,
					frame.vocabDomain,
					frame.communicativeFunction,
					...frame.tags,
				],
				phraseFamily: frame.label,
				phase: 'produce',
				action: actionForFunction(frame.communicativeFunction),
				communicativeGoal: frame.seedEnglish,
				spokenCue: 'Say the useful version quickly, then type it.',
				repairPrompts: [
					frame.seedEnglish,
					`Change one detail but keep the same pattern: ${frame.seedEnglish}`,
				],
				keyVerb: frame.tags[0] ?? 'fare',
				construction: `frame:${frame.id}`,
				npcLine: '',
				frameId: frame.id,
				tenseFocus: frame.tenseFocus,
				vocabDomain: frame.vocabDomain,
				communicativeFunction: frame.communicativeFunction,
				maxWords,
				utilityScore: frame.utilityScore,
				cefrLevel: frame.cefrLevel,
			}
		})
	}
	return []
}

function sanitizeExercises(exercises: GeneratedExercise[], count: number, body: Body) {
	const seen = new Set<string>()
	const seenItalian: string[] = (body.avoidItalian ?? []).map(normaliseSentence)
	const seenEnglish: string[] = (body.avoidEnglish ?? []).map(normaliseSentence)
	const level = normaliseLevel(body.level)
	const sentenceLength = normaliseLength(body.sentenceLength)
	const defaultMaxWords = defaultMaxWordsFor(level, sentenceLength)
	const frames = new Map(
		(body.conversationFrames ?? []).map((frame) => [frame.id, frame])
	)
	return exercises
		.filter((exercise) => exercise.promptEnglish && exercise.targetItalian)
		.filter((exercise) => promptIsCleanEnglish(exercise.promptEnglish))
		.filter((exercise) => {
			const english = normaliseSentence(exercise.promptEnglish)
			const italian = normaliseSentence(exercise.targetItalian)
			const key = `${english}::${italian}`
			const maxWords = clampMaxWords(exercise.maxWords, defaultMaxWords)
			const utilityScore = clampUtilityScore(exercise.utilityScore, 0)
			const frame = frames.get(exercise.frameId)
			if (utilityScore < 70) return false
			if (!levels.includes(exercise.cefrLevel)) return false
			if (exercise.cefrLevel !== level) return false
			if (
				frame &&
				(exercise.cefrLevel !== frame.cefrLevel ||
					exercise.tenseFocus !== frame.tenseFocus ||
					exercise.vocabDomain !== frame.vocabDomain ||
					exercise.communicativeFunction !== frame.communicativeFunction)
			) {
				return false
			}
			if (
				body.sessionDomain &&
				body.sessionDomain !== 'mixed' &&
				exercise.vocabDomain !== body.sessionDomain
			) {
				return false
			}
			if (wordCount(exercise.targetItalian) > maxWords) return false
			if (isBannedSentence(english) || isBannedSentence(italian)) return false
			if (seen.has(key)) return false
			if (
				hasNearDuplicate(italian, seenItalian) ||
				hasNearDuplicate(english, seenEnglish)
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
			action: actionForFunction(exercise.communicativeFunction),
			communicativeGoal: exercise.promptEnglish,
			acceptedItalian: exercise.acceptedItalian.length
				? exercise.acceptedItalian
				: [exercise.targetItalian],
			hints: exercise.hints.slice(0, 3),
			tags: Array.from(new Set(exercise.tags.filter(Boolean))).slice(0, 8),
			repairPrompts: exercise.repairPrompts.length
				? exercise.repairPrompts.slice(0, 3)
				: [exercise.promptEnglish],
			maxWords: clampMaxWords(exercise.maxWords, defaultMaxWords),
			utilityScore: clampUtilityScore(exercise.utilityScore, 70),
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
						'You design short Italian speaking microcycles for one learner. Return only schema-valid JSON. Create natural modern spoken Italian from the supplied frames. Repeat a useful pattern while changing one concrete detail at a time. Accuracy of the English meaning and Italian model is essential.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						task: `Generate exactly ${count} unique short speaking drills for one coherent practice session.`,
						level,
						levelGuidance: levelGuidance(level),
						sentenceLength,
						lengthGuidance: lengthGuidance(sentenceLength),
						stage: body.stage,
						sessionFocus: {
							id: body.sessionFocus ?? 'adaptive',
							label: body.sessionFocusLabel ?? body.sessionFocus ?? 'adaptive',
							domain: body.sessionDomain ?? 'mixed',
							challenge: body.challengeMode ?? 'stretch',
						},
						activeTenseFocuses: body.activeTenseFocuses ?? body.stage?.tenseFocuses ?? [],
						recognitionOnlyTenses: body.recognitionOnlyTenses ?? [],
						conversationFrames: body.conversationFrames ?? [],
						scene: {
							id: body.sceneId,
							title: body.sceneTitle,
							action: body.action,
						},
						weakTags: body.weakTags ?? [],
						requirements: [
							'Do not repeat avoidItalian or avoidEnglish.',
							'Do not produce near-duplicates inside this pack.',
							'Every item must use one provided conversationFrame and copy its frameId, tenseFocus, vocabDomain, communicativeFunction, maxWords, utilityScore, and cefrLevel.',
							'Every item must be at the exact requested CEFR level. Increase independence and pragmatic precision at higher levels, not sentence length.',
							'Every targetItalian must be at or under the frame maxWords value.',
							'Every utilityScore must be 70-100 and should reflect everyday usefulness.',
							'Every promptEnglish should be a clear British English communicative intent.',
							'promptEnglish must be pure English: no Italian words, no mixed-language phrases, and no meta instructions such as "Use it in a conversation".',
							'Every targetItalian should be a natural sentence the learner could say aloud.',
							'Every promptEnglish must be an exact, unambiguous translation of targetItalian, including person, number, tense, and time relationships.',
							'action must be the plain-language label for that item\'s communicativeFunction; never copy the overall scene action onto an item with a different function.',
							'communicativeGoal must repeat the precise English intention in promptEnglish, not a grammar label such as "narrate".',
							'npcLine must be a short natural Italian line from another speaker which makes the learner response sensible; do not put an English instruction there.',
							'promptEnglish, action, communicativeGoal, npcLine, targetItalian, and frame metadata must describe one coherent conversational turn.',
							'Use common adult situations: food, family, sport, cafe, shopping, travel, home, health, culture, or local news.',
							'Reject surreal, abstract, literary, classroom-only, or low-utility sentences.',
							'Do not actively drill recognitionOnlyTenses; mention them only if needed for recognition.',
							'Keep grammar systematic: vary vocabulary and concrete details, but reuse the same frame enough to build speed.',
							'For each chosen frame, create two to four related variations before moving on. Change only one or two slots between adjacent variations.',
							'When practising grammar or fluency, use high-frequency familiar vocabulary. When practising vocabulary, keep the grammar familiar.',
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

async function validateWithOpenAI(
	body: Body,
	exercises: GeneratedExercise[]
): Promise<GeneratedExercise[] | null> {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey || !exercises.length) return null
	const level = normaliseLevel(body.level)
	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model:
				getEnv('OPENAI_VALIDATION_MODEL') ||
				getEnv('OPENAI_CONTENT_MODEL') ||
				getEnv('OPENAI_MODEL') ||
				'gpt-5.4-mini',
			store: false,
			input: [
				{
					role: 'system',
					content:
						'You are an independent Italian teaching-content reviewer. Reject an item instead of silently repairing it. Check exact bilingual meaning, natural contemporary spoken Italian, CEFR fit, practical usefulness, and the supplied frame constraints. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						level,
						focus: body.sessionFocus,
						domain: body.sessionDomain,
						frames: body.conversationFrames ?? [],
						requirements: [
							'English and Italian must express the same person, number, tense, modality, and time relationship.',
							'Italian must sound natural in an ordinary adult conversation.',
							'The item must match its frameId metadata and exact requested CEFR level.',
							'The target must stay within maxWords and avoid abstract, surreal, literary, or classroom-only content.',
							'npcLine, when present, must be natural Italian and make targetItalian a sensible response.',
							'action and communicativeFunction must agree, and communicativeGoal must preserve the exact promptEnglish intention.',
							'All visible fields must form one coherent turn; reject unrelated context, cues, targets, or metadata.',
						],
						exercises: exercises.map((exercise, index) => ({ index, ...exercise })),
					}),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_content_validation',
					strict: true,
					schema: validationSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		const parsed = JSON.parse(text) as {
			reviews?: Array<{ index?: number; valid?: boolean }>
		}
		const validIndexes = new Set(
			(parsed.reviews ?? [])
				.filter((review) => review.valid && Number.isInteger(review.index))
				.map((review) => Number(review.index))
		)
		return exercises.filter((_, index) => validIndexes.has(index))
	} catch {
		return null
	}
}

function mergeHistory(current: string[], additions: string[]) {
	const seen = new Set<string>()
	const merged: string[] = []
	for (const value of [...current, ...additions]) {
		const key = normaliseSentence(value)
		if (!key || seen.has(key)) continue
		seen.add(key)
		merged.push(value)
	}
	return merged
}

async function loadContentHistory(userId: string) {
	const store = getStore({ name: 'content-history', consistency: 'strong' })
	const key = `users/${encodeURIComponent(userId)}/sentences/history`
	const stored = (await store.get(key, { type: 'json' })) as ContentHistory | null
	let italian = Array.isArray(stored?.italian) ? stored.italian : []
	let english = Array.isArray(stored?.english) ? stored.english : []
	if (!italian.length && !english.length) {
		try {
			const packStore = getStore({ name: 'generated-packs' })
			const prefix = `users/${encodeURIComponent(userId)}/sentences/`
			const { blobs } = await packStore.list({ prefix })
			const packs = (await Promise.all(
				blobs.map((blob) => packStore.get(blob.key, { type: 'json' }))
			)) as Array<{ exercises?: GeneratedExercise[] } | null>
			italian = mergeHistory(
				italian,
				packs.flatMap((pack) =>
					(pack?.exercises ?? []).map((exercise) => exercise.targetItalian)
				)
			)
			english = mergeHistory(
				english,
				packs.flatMap((pack) =>
					(pack?.exercises ?? []).map((exercise) => exercise.promptEnglish)
				)
			)
		} catch {
			// A missing old library should not prevent a fresh pack being generated.
		}
	}
	return {
		store,
		key,
		history: {
			italian,
			english,
		} satisfies ContentHistory,
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body) return json({ error: 'Missing generation request' }, { status: 400 })
	const count = clampCount(body.targetCount)
	const { store: historyStore, key: historyKey, history } =
		await loadContentHistory(auth.user.id)
	const generationBody: Body = {
		...body,
		avoidItalian: mergeHistory(history.italian, body.avoidItalian ?? []),
		avoidEnglish: mergeHistory(history.english, body.avoidEnglish ?? []),
	}
	const packId = `${new Date().toISOString()}-${simpleHash(
		JSON.stringify({
			level: body.level,
			programWeek: body.programWeek,
			action: body.action,
			sceneId: body.sceneId,
			focus: body.sessionFocus,
			domain: body.sessionDomain,
		})
	)}`

	const ai = await generateWithOpenAI(generationBody, count)
	const independentlyValidated = ai
		? await validateWithOpenAI(generationBody, ai)
		: null
	const reviewedAI = independentlyValidated ?? []
	let exercises = sanitizeExercises(reviewedAI, count, generationBody)
	let provider: 'openai' | 'fallback' = 'openai'
	if (!exercises.length) {
		exercises = sanitizeExercises(
			fallbackPack(generationBody, count * 2),
			count,
			generationBody
		)
		provider = 'fallback'
	}

	await historyStore.setJSON(historyKey, {
		italian: mergeHistory(history.italian, exercises.map((item) => item.targetItalian)),
		english: mergeHistory(history.english, exercises.map((item) => item.promptEnglish)),
		updatedAt: new Date().toISOString(),
	})

	const payload = {
		contentVersion,
		packId,
		provider,
		level: normaliseLevel(body.level),
		programWeek: body.programWeek ?? null,
		sessionFocus: body.sessionFocus ?? 'adaptive',
		sessionDomain: body.sessionDomain ?? 'mixed',
		challengeMode: body.challengeMode ?? 'stretch',
		sceneId: body.sceneId ?? null,
		sceneTitle: body.sceneTitle ?? null,
		action: body.action ?? null,
		sentenceLength: normaliseLength(body.sentenceLength),
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

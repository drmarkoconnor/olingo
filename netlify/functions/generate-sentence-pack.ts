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
}

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

const domainSlots: Record<
	VocabDomain,
	{
		objects: { en: string; it: string }[]
		tasks: { en: string; it: string }[]
		places: { en: string; it: string }[]
		times: { en: string; it: string }[]
		adjectives: { en: string; it: string }[]
		participles: { en: string; it: string }[]
		imperfects: { en: string; it: string }[]
	}
> = {
	food: {
		objects: [
			{ en: 'the salt', it: 'il sale' },
			{ en: 'the bread', it: 'il pane' },
			{ en: 'the water', it: 'l acqua' },
			{ en: 'the plate', it: 'il piatto' },
		],
		tasks: [
			{ en: 'dinner', it: 'la cena' },
			{ en: 'the table', it: 'la tavola' },
			{ en: 'the shopping', it: 'la spesa' },
		],
		places: [
			{ en: 'on the table', it: 'sul tavolo' },
			{ en: 'in the kitchen', it: 'in cucina' },
			{ en: 'next to you', it: 'accanto a te' },
		],
		times: [
			{ en: 'after dinner', it: 'dopo cena' },
			{ en: 'now', it: 'adesso' },
			{ en: 'later', it: 'piu tardi' },
		],
		adjectives: [
			{ en: 'good', it: 'buono' },
			{ en: 'simple', it: 'semplice' },
			{ en: 'too salty', it: 'troppo salato' },
		],
		participles: [
			{ en: 'chosen', it: 'scelto' },
			{ en: 'ordered', it: 'ordinato' },
			{ en: 'brought', it: 'portato' },
		],
		imperfects: [
			{ en: 'ate', it: 'mangiavo' },
			{ en: 'cooked', it: 'cucinavo' },
		],
	},
	family: {
		objects: [
			{ en: 'my brother', it: 'mio fratello' },
			{ en: 'my daughter', it: 'mia figlia' },
			{ en: 'the keys', it: 'le chiavi' },
		],
		tasks: [
			{ en: 'dinner', it: 'la cena' },
			{ en: 'the children', it: 'i bambini' },
			{ en: 'the plan', it: 'il programma' },
		],
		places: [
			{ en: 'at home', it: 'a casa' },
			{ en: 'in the kitchen', it: 'in cucina' },
			{ en: 'at mum s', it: 'da mamma' },
		],
		times: [
			{ en: 'today', it: 'oggi' },
			{ en: 'tonight', it: 'stasera' },
			{ en: 'this weekend', it: 'questo weekend' },
		],
		adjectives: [
			{ en: 'important', it: 'importante' },
			{ en: 'easy', it: 'facile' },
			{ en: 'clear', it: 'chiaro' },
		],
		participles: [
			{ en: 'called', it: 'chiamato' },
			{ en: 'seen', it: 'visto' },
			{ en: 'helped', it: 'aiutato' },
		],
		imperfects: [
			{ en: 'played', it: 'giocavo' },
			{ en: 'went', it: 'andavo' },
		],
	},
	sport: {
		objects: [
			{ en: 'the match', it: 'la partita' },
			{ en: 'the tickets', it: 'i biglietti' },
			{ en: 'the team', it: 'la squadra' },
		],
		tasks: [
			{ en: 'the match', it: 'la partita' },
			{ en: 'the tickets', it: 'i biglietti' },
		],
		places: [
			{ en: 'at the bar', it: 'al bar' },
			{ en: 'at the stadium', it: 'allo stadio' },
			{ en: 'outside', it: 'fuori' },
		],
		times: [
			{ en: 'after the match', it: 'dopo la partita' },
			{ en: 'at eight', it: 'alle otto' },
			{ en: 'tomorrow', it: 'domani' },
		],
		adjectives: [
			{ en: 'good', it: 'buona' },
			{ en: 'close', it: 'combattuta' },
			{ en: 'slow', it: 'lenta' },
		],
		participles: [
			{ en: 'watched', it: 'guardato' },
			{ en: 'lost', it: 'perso' },
		],
		imperfects: [
			{ en: 'played', it: 'giocavo' },
			{ en: 'watched', it: 'guardavo' },
		],
	},
	cafe: {
		objects: [
			{ en: 'a coffee', it: 'un caffe' },
			{ en: 'the bill', it: 'il conto' },
			{ en: 'a table', it: 'un tavolo' },
		],
		tasks: [
			{ en: 'the order', it: 'l ordine' },
			{ en: 'the bill', it: 'il conto' },
		],
		places: [
			{ en: 'at the bar', it: 'al bar' },
			{ en: 'outside', it: 'fuori' },
			{ en: 'near the window', it: 'vicino alla finestra' },
		],
		times: [
			{ en: 'later', it: 'dopo' },
			{ en: 'tomorrow', it: 'domani' },
			{ en: 'after coffee', it: 'dopo il caffe' },
		],
		adjectives: [
			{ en: 'good', it: 'buono' },
			{ en: 'busy', it: 'pieno' },
			{ en: 'quiet', it: 'tranquillo' },
		],
		participles: [
			{ en: 'paid', it: 'pagato' },
			{ en: 'ordered', it: 'ordinato' },
			{ en: 'asked', it: 'chiesto' },
		],
		imperfects: [
			{ en: 'drank', it: 'bevevo' },
			{ en: 'came', it: 'venivo' },
		],
	},
	shopping: {
		objects: [
			{ en: 'this one', it: 'questo' },
			{ en: 'another size', it: 'un altra taglia' },
			{ en: 'the receipt', it: 'lo scontrino' },
		],
		tasks: [
			{ en: 'this one', it: 'questo' },
			{ en: 'another size', it: 'un altra taglia' },
		],
		places: [
			{ en: 'in the shop', it: 'nel negozio' },
			{ en: 'near the till', it: 'vicino alla cassa' },
		],
		times: [
			{ en: 'now', it: 'adesso' },
			{ en: 'later', it: 'piu tardi' },
		],
		adjectives: [
			{ en: 'expensive', it: 'caro' },
			{ en: 'useful', it: 'utile' },
		],
		participles: [
			{ en: 'bought', it: 'comprato' },
			{ en: 'tried', it: 'provato' },
		],
		imperfects: [
			{ en: 'bought', it: 'compravo' },
			{ en: 'looked for', it: 'cercavo' },
		],
	},
	travel: {
		objects: [
			{ en: 'platform two', it: 'il binario due' },
			{ en: 'the ticket', it: 'il biglietto' },
			{ en: 'the exit', it: 'l uscita' },
		],
		tasks: [
			{ en: 'the ticket', it: 'il biglietto' },
			{ en: 'the platform', it: 'il binario' },
		],
		places: [
			{ en: 'at the station', it: 'in stazione' },
			{ en: 'on platform two', it: 'al binario due' },
			{ en: 'near the exit', it: 'vicino all uscita' },
		],
		times: [
			{ en: 'later', it: 'piu tardi' },
			{ en: 'at six', it: 'alle sei' },
			{ en: 'tomorrow', it: 'domani' },
		],
		adjectives: [
			{ en: 'clear', it: 'chiaro' },
			{ en: 'late', it: 'in ritardo' },
		],
		participles: [
			{ en: 'missed', it: 'perso' },
			{ en: 'found', it: 'trovato' },
		],
		imperfects: [
			{ en: 'waited', it: 'aspettavo' },
			{ en: 'travelled', it: 'viaggiavo' },
		],
	},
	home: {
		objects: [
			{ en: 'the keys', it: 'le chiavi' },
			{ en: 'the phone', it: 'il telefono' },
			{ en: 'the bag', it: 'la borsa' },
		],
		tasks: [
			{ en: 'the kitchen', it: 'la cucina' },
			{ en: 'the table', it: 'il tavolo' },
		],
		places: [
			{ en: 'at home', it: 'a casa' },
			{ en: 'on the table', it: 'sul tavolo' },
			{ en: 'in the kitchen', it: 'in cucina' },
		],
		times: [
			{ en: 'today', it: 'oggi' },
			{ en: 'later', it: 'dopo' },
		],
		adjectives: [
			{ en: 'ready', it: 'pronto' },
			{ en: 'open', it: 'aperto' },
		],
		participles: [
			{ en: 'lost', it: 'perso' },
			{ en: 'found', it: 'trovato' },
		],
		imperfects: [
			{ en: 'stayed', it: 'stavo' },
			{ en: 'worked', it: 'lavoravo' },
		],
	},
	health: {
		objects: [
			{ en: 'some water', it: 'un po d acqua' },
			{ en: 'a chair', it: 'una sedia' },
			{ en: 'a minute', it: 'un minuto' },
		],
		tasks: [
			{ en: 'a minute', it: 'un minuto' },
			{ en: 'some water', it: 'un po d acqua' },
		],
		places: [
			{ en: 'here', it: 'qui' },
			{ en: 'inside', it: 'dentro' },
		],
		times: [
			{ en: 'today', it: 'oggi' },
			{ en: 'now', it: 'adesso' },
		],
		adjectives: [
			{ en: 'better', it: 'meglio' },
			{ en: 'tired', it: 'stanco' },
		],
		participles: [
			{ en: 'slept', it: 'dormito' },
			{ en: 'rested', it: 'riposato' },
		],
		imperfects: [
			{ en: 'felt', it: 'stavo' },
			{ en: 'slept', it: 'dormivo' },
		],
	},
	culture: {
		objects: [
			{ en: 'the film', it: 'il film' },
			{ en: 'the book', it: 'il libro' },
			{ en: 'the concert', it: 'il concerto' },
		],
		tasks: [
			{ en: 'the film', it: 'il film' },
			{ en: 'the concert', it: 'il concerto' },
		],
		places: [
			{ en: 'at the cinema', it: 'al cinema' },
			{ en: 'in the square', it: 'in piazza' },
		],
		times: [
			{ en: 'later', it: 'dopo' },
			{ en: 'tomorrow', it: 'domani' },
		],
		adjectives: [
			{ en: 'interesting', it: 'interessante' },
			{ en: 'slow', it: 'lento' },
			{ en: 'clear', it: 'chiaro' },
		],
		participles: [
			{ en: 'seen', it: 'visto' },
			{ en: 'read', it: 'letto' },
		],
		imperfects: [
			{ en: 'watched', it: 'guardavo' },
			{ en: 'read', it: 'leggevo' },
		],
	},
	'local-news': {
		objects: [
			{ en: 'the news', it: 'la notizia' },
			{ en: 'the problem', it: 'il problema' },
			{ en: 'the decision', it: 'la decisione' },
		],
		tasks: [
			{ en: 'the news', it: 'la notizia' },
			{ en: 'the decision', it: 'la decisione' },
		],
		places: [
			{ en: 'here', it: 'qui' },
			{ en: 'in town', it: 'in citta' },
		],
		times: [
			{ en: 'today', it: 'oggi' },
			{ en: 'this week', it: 'questa settimana' },
		],
		adjectives: [
			{ en: 'important', it: 'importante' },
			{ en: 'serious', it: 'serio' },
			{ en: 'useful', it: 'utile' },
		],
		participles: [
			{ en: 'read', it: 'letto' },
			{ en: 'understood', it: 'capito' },
		],
		imperfects: [
			{ en: 'seemed', it: 'sembrava' },
			{ en: 'changed', it: 'cambiava' },
		],
	},
}

function pick<T>(items: T[], index: number) {
	return items[index % items.length]
}

function variantForFrame(frame: ConversationFramePayload, index: number) {
	const slots = domainSlots[frame.vocabDomain]
	const object = pick(slots.objects, index)
	const task = pick(slots.tasks, index + 1)
	const place = pick(slots.places, index + 2)
	const time = pick(slots.times, index + 3)
	const adjective = pick(slots.adjectives, index + 4)
	const participle = pick(slots.participles, index + 5)
	const imperfect = pick(slots.imperfects, index + 6)

	if (frame.tenseFocus === 'imperative') {
		return {
			en: `Pass me ${object.en}, please.`,
			it: `Passami ${object.it}, per favore.`,
			keyVerb: 'passare',
			construction: 'imperative-request',
		}
	}
	if (frame.tenseFocus === 'modal-infinitive') {
		return {
			en: `Can I help with ${task.en}?`,
			it: `Posso aiutare con ${task.it}?`,
			keyVerb: 'potere',
			construction: 'modal-infinitive',
		}
	}
	if (frame.tenseFocus === 'passato-prossimo') {
		return {
			en: `I have already ${participle.en} ${object.en}.`,
			it: `Ho gia ${participle.it} ${object.it}.`,
			keyVerb: 'avere',
			construction: 'passato-prossimo',
		}
	}
	if (frame.tenseFocus === 'imperfect') {
		return {
			en: `When I was younger, I ${imperfect.en} here.`,
			it: `Da giovane ${imperfect.it} qui.`,
			keyVerb: imperfect.it,
			construction: 'imperfect-background',
		}
	}
	if (frame.tenseFocus === 'future') {
		return {
			en: `We will meet ${time.en}.`,
			it: `Ci vedremo ${time.it}.`,
			keyVerb: 'vedere',
			construction: 'future-plan',
		}
	}
	if (frame.tenseFocus === 'conditional') {
		return {
			en: `I would like ${object.en}, please.`,
			it: `Vorrei ${object.it}, per favore.`,
			keyVerb: 'volere',
			construction: 'conditional-request',
		}
	}
	if (frame.tenseFocus === 'subjunctive-chunk') {
		return {
			en: `I think it is ${adjective.en}.`,
			it: `Penso che sia ${adjective.it}.`,
			keyVerb: 'pensare',
			construction: 'subjunctive-chunk-opinion',
		}
	}
	if (frame.communicativeFunction === 'repair') {
		return {
			en: 'I did not understand well.',
			it: 'Non ho capito bene.',
			keyVerb: 'capire',
			construction: 'conversation-repair',
		}
	}
	if (frame.communicativeFunction === 'locate') {
		return {
			en: `${object.en} is ${place.en}.`,
			it: `${object.it} e ${place.it}.`,
			keyVerb: 'essere',
			construction: 'present-location',
		}
	}
	if (frame.communicativeFunction === 'ask-back') {
		return {
			en: `And what are you doing ${time.en}?`,
			it: `E tu che fai ${time.it}?`,
			keyVerb: 'fare',
			construction: 'present-question',
		}
	}
	if (frame.communicativeFunction === 'refuse-politely') {
		return {
			en: `Sorry, I cannot come ${time.en}.`,
			it: `Mi dispiace, ${time.it} non posso.`,
			keyVerb: 'potere',
			construction: 'polite-refusal',
		}
	}
	if (frame.communicativeFunction === 'give-reason') {
		return {
			en: `I like it because it is ${adjective.en}.`,
			it: `Mi piace perche e ${adjective.it}.`,
			keyVerb: 'piacere',
			construction: 'present-reason',
		}
	}
	if (frame.communicativeFunction === 'react') {
		return {
			en: `I like it, but it is ${adjective.en}.`,
			it: `Mi piace, ma e ${adjective.it}.`,
			keyVerb: 'piacere',
			construction: 'present-reaction',
		}
	}
	if (frame.communicativeFunction === 'plan') {
		return {
			en: `See you ${time.en}.`,
			it: `Ci vediamo ${time.it}.`,
			keyVerb: 'vedere',
			construction: 'present-plan',
		}
	}
	return {
		en: frame.seedEnglish,
		it: frame.seedItalian,
		keyVerb: frame.tags[0] ?? 'fare',
		construction: `${frame.tenseFocus}-${frame.communicativeFunction}`,
	}
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
		return Array.from({ length: count }, (_, index) => {
			const frame = frames[index % frames.length]
			const variant = variantForFrame(frame, index)
			const maxWords = clampMaxWords(frame.maxWords, defaultMaxWordsFor(level, 'medium'))
			const useSeed = wordCount(variant.it) > maxWords
			const targetItalian = useSeed ? frame.seedItalian : variant.it
			const promptEnglish = useSeed ? frame.seedEnglish : variant.en
			return {
				promptEnglish,
				targetItalian,
				acceptedItalian: [targetItalian],
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
				action: body.action || frame.communicativeFunction,
				communicativeGoal: `${frame.communicativeFunction} in a ${frame.vocabDomain} situation.`,
				spokenCue: 'Say the useful version quickly, then type it.',
				repairPrompts: [
					promptEnglish,
					`Change one detail but keep the same frame: ${promptEnglish}`,
				],
				keyVerb: variant.keyVerb,
				construction: variant.construction,
				npcLine: '',
				frameId: frame.id,
				tenseFocus: frame.tenseFocus,
				vocabDomain: frame.vocabDomain,
				communicativeFunction: frame.communicativeFunction,
				maxWords,
				utilityScore: frame.utilityScore,
			}
		})
	}
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
			personEn: 'my daughter',
			personIt: 'mia figlia',
			activityEn: 'prepare the pasta',
			activityIt: 'preparare la pasta',
			placeEn: 'in the kitchen',
			placeIt: 'in cucina',
			objectEn: 'the table',
			objectIt: 'il tavolo',
		},
		{
			en: 'before the football match',
			it: 'prima della partita',
			personEn: 'my brother',
			personIt: 'mio fratello',
			activityEn: 'watch the match',
			activityIt: 'guardare la partita',
			placeEn: 'at the bar',
			placeIt: 'al bar',
			objectEn: 'the tickets',
			objectIt: 'i biglietti',
		},
		{
			en: 'during a coffee with friends',
			it: 'durante un caffe con amici',
			personEn: 'my friend',
			personIt: 'la mia amica',
			activityEn: 'have a coffee',
			activityIt: 'prendere un caffe',
			placeEn: 'in town',
			placeIt: 'in centro',
			objectEn: 'the bill',
			objectIt: 'il conto',
		},
		{
			en: 'after a family visit',
			it: 'dopo una visita in famiglia',
			personEn: 'my mother',
			personIt: 'mia madre',
			activityEn: 'go for a walk',
			activityIt: 'fare una passeggiata',
			placeEn: 'in the park',
			placeIt: 'nel parco',
			objectEn: 'the bag',
			objectIt: 'la borsa',
		},
		{
			en: 'at a small cultural event',
			it: 'a un piccolo evento culturale',
			personEn: 'the group',
			personIt: 'il gruppo',
			activityEn: 'listen to the music',
			activityIt: 'ascoltare la musica',
			placeEn: 'in the square',
			placeIt: 'in piazza',
			objectEn: 'the programme',
			objectIt: 'il programma',
		},
		{
			en: 'while choosing food',
			it: 'mentre scegliamo da mangiare',
			personEn: 'the waiter',
			personIt: 'il cameriere',
			activityEn: 'order something',
			activityIt: 'ordinare qualcosa',
			placeEn: 'at the restaurant',
			placeIt: 'al ristorante',
			objectEn: 'the menu',
			objectIt: 'il menu',
		},
	]
	const templates = [
		(s: (typeof situations)[number]) => ({
			en: `I want to speak more calmly ${s.en}.`,
			it: `Voglio parlare con piu calma ${s.it}.`,
			construction: 'modal-infinitive',
		}),
		(s: (typeof situations)[number]) => ({
			en: `Can I help ${s.personEn} ${s.en}?`,
			it: `Posso aiutare ${s.personIt} ${s.it}?`,
			construction: 'modal-question',
		}),
		(s: (typeof situations)[number]) => ({
			en: `I have to ${s.activityEn} before leaving.`,
			it: `Devo ${s.activityIt} prima di partire.`,
			construction: 'dovere-infinitive',
		}),
		(s: (typeof situations)[number]) => ({
			en: `Yesterday I saw ${s.personEn} ${s.en}.`,
			it: `Ieri ho visto ${s.personIt} ${s.it}.`,
			construction: 'past-event',
		}),
		(s: (typeof situations)[number]) => ({
			en: `In my opinion, this is a good idea ${s.en}.`,
			it: `Secondo me, questa e una buona idea ${s.it}.`,
			construction: 'opinion-frame',
		}),
		(s: (typeof situations)[number]) => ({
			en: `Can you tell me where ${s.objectEn} is?`,
			it: `Puoi dirmi dove si trova ${s.objectIt}?`,
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
			en: `I brought ${s.objectEn} because it was useful.`,
			it: `Ho portato ${s.objectIt} perche era utile.`,
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
		const tenseFocus: TenseFocus = base.construction.includes('past')
			? 'passato-prossimo'
			: base.construction.includes('conditional')
			? 'conditional'
			: base.construction.includes('modal')
			? 'modal-infinitive'
			: 'present'
		const communicativeFunction: CommunicativeFunction =
			base.construction.includes('question') || base.construction.includes('request')
				? 'request'
				: base.construction.includes('repair')
				? 'repair'
				: base.construction.includes('reason')
				? 'give-reason'
				: base.construction.includes('past')
				? 'narrate'
				: 'plan'
		const vocabDomain: VocabDomain = topic.includes('family')
			? 'family'
			: topic.includes('food')
			? 'food'
			: topic.includes('news')
			? 'local-news'
			: 'home'
		return {
			promptEnglish: base.en,
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
			frameId: `legacy-${base.construction}`,
			tenseFocus,
			vocabDomain,
			communicativeFunction,
			maxWords: defaultMaxWordsFor(level, 'medium'),
			utilityScore: 76,
		}
	})
}

function sanitizeExercises(exercises: GeneratedExercise[], count: number, body: Body) {
	const seen = new Set<string>()
	const seenItalian: string[] = (body.avoidItalian ?? []).map(normaliseSentence)
	const seenEnglish: string[] = (body.avoidEnglish ?? []).map(normaliseSentence)
	const level = normaliseLevel(body.level)
	const sentenceLength = normaliseLength(body.sentenceLength)
	const defaultMaxWords = defaultMaxWordsFor(level, sentenceLength)
	return exercises
		.filter((exercise) => exercise.promptEnglish && exercise.targetItalian)
		.filter((exercise) => promptIsCleanEnglish(exercise.promptEnglish))
		.filter((exercise) => {
			const english = normaliseSentence(exercise.promptEnglish)
			const italian = normaliseSentence(exercise.targetItalian)
			const key = `${english}::${italian}`
			const maxWords = clampMaxWords(exercise.maxWords, defaultMaxWords)
			const utilityScore = clampUtilityScore(exercise.utilityScore, 0)
			if (utilityScore < 70) return false
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
						'You generate Italian sentence-production drills for one learner. Return only schema-valid JSON. Create fresh, natural, spoken Italian prompts from the provided conversation frames. Use patterned variety: repeat useful grammar frames, vary concrete details.',
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
							'Every item must use one provided conversationFrame and copy its frameId, tenseFocus, vocabDomain, communicativeFunction, maxWords, and utilityScore.',
							'Every targetItalian must be at or under the frame maxWords value.',
							'Every utilityScore must be 70-100 and should reflect everyday usefulness.',
							'Every promptEnglish should be a clear British English communicative intent.',
							'promptEnglish must be pure English: no Italian words, no mixed-language phrases, and no meta instructions such as "Use it in a conversation".',
							'Every targetItalian should be a natural sentence the learner could say aloud.',
							'Use common adult situations: food, family, sport, cafe, shopping, travel, home, health, culture, or local news.',
							'Reject surreal, abstract, literary, classroom-only, or low-utility sentences.',
							'Do not actively drill recognitionOnlyTenses; mention them only if needed for recognition.',
							'Keep grammar systematic: vary vocabulary and concrete details, but reuse the same frame enough to build speed.',
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
	const exercises = sanitizeExercises(ai ?? fallbackPack(body, count), count, body)
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

import type { CefrLevel } from './content'

export type DrillFamilyId =
	| 'doing-making'
	| 'modal-engine'
	| 'movement'
	| 'giving'
	| 'speaking'
	| 'taking-placing'
	| 'experiencer-patterns'
	| 'reflexive-routines'

export type DrillFocus =
	| 'guided'
	| 'forms'
	| 'polarity'
	| 'pronouns'
	| 'time-shifts'
	| 'conversation'

export type DrillStage =
	| 'meet'
	| 'retrieve'
	| 'switch'
	| 'polarity'
	| 'pronoun'
	| 'time'
	| 'conversation'

export type DrillFamily = {
	id: DrillFamilyId
	label: string
	shortLabel: string
	anchors: string[]
	description: string
	bookChapters: number[]
	bookPrinciple: string
	keyVerbs: string[]
	domains: string[]
	contrasts: string[]
	supports: DrillFocus[]
	seedExamples: Array<{ english: string; italian: string }>
}

export type DrillFocusDefinition = {
	id: DrillFocus
	label: string
	shortLabel: string
	description: string
	minLevel: CefrLevel
}

export const drillFocuses: DrillFocusDefinition[] = [
	{
		id: 'guided',
		label: 'Full progression',
		shortLabel: 'Guided',
		description: 'Climb from a clear model to an independent conversational reply.',
		minLevel: 'A1',
	},
	{
		id: 'forms',
		label: 'Change the person',
		shortLabel: 'Person',
		description: 'Switch quickly between I, you, we, and they.',
		minLevel: 'A1',
	},
	{
		id: 'polarity',
		label: 'Questions and negatives',
		shortLabel: 'Questions',
		description: 'Turn useful statements into questions, refusals, and corrections.',
		minLevel: 'A1',
	},
	{
		id: 'pronouns',
		label: 'People, things, and pronouns',
		shortLabel: 'Pronouns',
		description: 'Move from clear nouns to lo, la, gli, le, and combined forms.',
		minLevel: 'A2',
	},
	{
		id: 'time-shifts',
		label: 'Present, past, and future',
		shortLabel: 'Time',
		description: 'Keep the same useful meaning while changing when it happens.',
		minLevel: 'A2',
	},
	{
		id: 'conversation',
		label: 'Quick conversational replies',
		shortLabel: 'Replies',
		description: 'Respond to short Italian turns without translating a whole scene.',
		minLevel: 'A1',
	},
]

export const drillStageLabels: Record<DrillStage, string> = {
	meet: 'Meet the pattern',
	retrieve: 'Retrieve the meaning',
	switch: 'Change the person or detail',
	polarity: 'Question or negate it',
	pronoun: 'Replace nouns with pronouns',
	time: 'Move it through time',
	conversation: 'Use it in conversation',
}

const commonSupports: DrillFocus[] = [
	'guided',
	'forms',
	'polarity',
	'time-shifts',
	'conversation',
]

export const drillFamilies: DrillFamily[] = [
	{
		id: 'doing-making',
		label: 'Doing, making, and sorting things out',
		shortLabel: 'Fare and daily actions',
		anchors: ['fare', 'preparare', 'sistemare', 'cambiare'],
		description: 'Talk about ordinary jobs, meals, errands, and changes of plan.',
		bookChapters: [1],
		bookPrinciple: 'Secure fare as the broad anchor before choosing a more exact action.',
		keyVerbs: ['fare', 'preparare', 'sistemare', 'cambiare'],
		domains: ['home', 'food', 'family'],
		contrasts: [
			'fare for a broad action',
			'preparare for getting something ready',
			'sistemare for putting something right',
		],
		supports: commonSupports,
		seedExamples: [
			{ english: 'I am making dinner.', italian: 'Preparo la cena.' },
			{ english: 'I will sort it out tomorrow.', italian: 'Sistemo tutto domani.' },
			{ english: 'We changed our minds.', italian: 'Abbiamo cambiato idea.' },
		],
	},
	{
		id: 'modal-engine',
		label: 'Wanting, being able, and having to',
		shortLabel: 'Want, can, and must',
		anchors: ['volere', 'potere', 'dovere', 'riuscire'],
		description: 'Build the high-frequency engine behind plans, offers, and obligations.',
		bookChapters: [3, 4],
		bookPrinciple: 'Contrast possibility, obligation, desire, and successful completion.',
		keyVerbs: ['volere', 'potere', 'dovere', 'riuscire'],
		domains: ['family', 'food', 'travel'],
		contrasts: [
			'potere for possibility or permission',
			'riuscire a when the result is actually achieved',
			'vorrei for a polite request',
		],
		supports: [...commonSupports, 'pronouns'],
		seedExamples: [
			{ english: 'I want to go home.', italian: 'Voglio andare a casa.' },
			{ english: 'Can you help me?', italian: 'Puoi aiutarmi?' },
			{ english: 'I have to call her.', italian: 'Devo chiamarla.' },
		],
	},
	{
		id: 'movement',
		label: 'Going, coming, leaving, and returning',
		shortLabel: 'Movement and plans',
		anchors: ['andare', 'venire', 'partire', 'tornare'],
		description: 'Arrange simple movements and say where people went or will meet.',
		bookChapters: [5],
		bookPrinciple: 'Keep viewpoint clear: andare moves away; venire moves towards.',
		keyVerbs: ['andare', 'venire', 'partire', 'tornare'],
		domains: ['travel', 'family', 'cafe'],
		contrasts: [
			'andare versus venire from the speaker viewpoint',
			'partire for a person leaving',
			'lasciare for leaving an object',
		],
		supports: commonSupports,
		seedExamples: [
			{ english: 'Are you coming with us?', italian: 'Vieni con noi?' },
			{ english: 'We left early.', italian: 'Siamo partiti presto.' },
			{ english: 'I will return after dinner.', italian: 'Tornerò dopo cena.' },
		],
	},
	{
		id: 'giving',
		label: 'Giving, passing, carrying, and returning',
		shortLabel: 'Give it to someone',
		anchors: ['dare', 'passare', 'portare', 'restituire'],
		description: 'Say what moves to whom, first clearly and then with useful pronouns.',
		bookChapters: [9],
		bookPrinciple: 'Secure the person and the thing separately before compressing them.',
		keyVerbs: ['dare', 'passare', 'portare', 'restituire'],
		domains: ['food', 'family', 'home'],
		contrasts: [
			'dare as the broad transfer verb',
			'passare for handing something nearby',
			'portare for carrying something to a place or person',
		],
		supports: [...commonSupports, 'pronouns'],
		seedExamples: [
			{ english: 'I give the book to my sister.', italian: 'Do il libro a mia sorella.' },
			{ english: 'I give it to her.', italian: 'Glielo do.' },
			{ english: 'Pass me the salt, please.', italian: 'Passami il sale, per favore.' },
		],
	},
	{
		id: 'speaking',
		label: 'Saying, asking, answering, and explaining',
		shortLabel: 'Say and explain it',
		anchors: ['dire', 'chiedere', 'rispondere', 'spiegare'],
		description: 'Handle messages, explanations, questions, and conversation repair.',
		bookChapters: [2, 11],
		bookPrinciple: 'Use dire for information and raccontare for a developed story.',
		keyVerbs: ['dire', 'chiedere', 'rispondere', 'spiegare', 'raccontare'],
		domains: ['family', 'culture', 'travel'],
		contrasts: [
			'dire for a fact or message',
			'raccontare for a story or sequence',
			'chiedere for both asking and requesting',
		],
		supports: [...commonSupports, 'pronouns'],
		seedExamples: [
			{ english: 'I will tell you the truth.', italian: 'Ti dico la verità.' },
			{ english: 'Can you explain it to me?', italian: 'Puoi spiegarmelo?' },
			{ english: 'I told her yesterday.', italian: 'Gliel\'ho detto ieri.' },
		],
	},
	{
		id: 'taking-placing',
		label: 'Taking, putting, holding, and leaving',
		shortLabel: 'Take it and put it',
		anchors: ['prendere', 'mettere', 'tenere', 'lasciare'],
		description: 'Move everyday objects and say exactly where they are.',
		bookChapters: [10, 15],
		bookPrinciple: 'Use prendere broadly, then distinguish holding, placing, and leaving.',
		keyVerbs: ['prendere', 'mettere', 'tenere', 'lasciare'],
		domains: ['home', 'travel', 'food'],
		contrasts: [
			'prendere for taking, getting, or catching',
			'mettere for putting something somewhere',
			'lasciare for leaving an object behind',
		],
		supports: [...commonSupports, 'pronouns'],
		seedExamples: [
			{ english: 'I am taking the train.', italian: 'Prendo il treno.' },
			{ english: 'Put it on the table.', italian: 'Mettilo sul tavolo.' },
			{ english: 'I left it in the kitchen.', italian: 'L\'ho lasciato in cucina.' },
		],
	},
	{
		id: 'experiencer-patterns',
		label: 'Liking, missing, needing, and seeming',
		shortLabel: 'Piacere and similar verbs',
		anchors: ['piacere', 'mancare', 'servire', 'sembrare'],
		description: 'Make the Italian person-pattern feel automatic instead of reversed.',
		bookChapters: [14, 22],
		bookPrinciple: 'The liked, missed, or needed thing controls the verb form.',
		keyVerbs: ['piacere', 'mancare', 'servire', 'bastare', 'sembrare'],
		domains: ['food', 'family', 'culture'],
		contrasts: [
			'mi piace with one thing versus mi piacciono with several',
			'mi serve versus mi servono',
			'the person is expressed with mi, ti, gli, le, or ci',
		],
		supports: [...commonSupports, 'pronouns'],
		seedExamples: [
			{ english: 'I like this coffee.', italian: 'Mi piace questo caffè.' },
			{ english: 'I need two chairs.', italian: 'Mi servono due sedie.' },
			{ english: 'It seems like a good idea to her.', italian: 'Le sembra una buona idea.' },
		],
	},
	{
		id: 'reflexive-routines',
		label: 'Getting ready, feeling, and remembering',
		shortLabel: 'Reflexive daily routines',
		anchors: ['alzarsi', 'vestirsi', 'sentirsi', 'ricordarsi'],
		description: 'Attach the reflexive pronoun without pausing over the sentence order.',
		bookChapters: [13, 14],
		bookPrinciple: 'Learn the pronoun and verb as one spoken unit, then change the person.',
		keyVerbs: ['alzarsi', 'vestirsi', 'sentirsi', 'ricordarsi', 'divertirsi'],
		domains: ['home', 'health', 'family'],
		contrasts: [
			'mi, ti, si, ci, vi before a finite verb',
			'pronoun attachment after an infinitive',
			'essere and agreement in the completed past',
		],
		supports: [...commonSupports, 'pronouns'],
		seedExamples: [
			{ english: 'I get up early.', italian: 'Mi alzo presto.' },
			{ english: 'I have to get dressed.', italian: 'Devo vestirmi.' },
			{ english: 'We enjoyed ourselves.', italian: 'Ci siamo divertiti.' },
		],
	},
]

const levelOrder: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

export function drillLevelRank(level: CefrLevel) {
	return levelOrder.indexOf(level)
}

export function getDrillFamily(id: DrillFamilyId) {
	return drillFamilies.find((family) => family.id === id) ?? drillFamilies[0]
}

export function getDrillFocus(id: DrillFocus) {
	return drillFocuses.find((focus) => focus.id === id) ?? drillFocuses[0]
}

export function drillFocusAvailable(
	family: DrillFamily,
	focus: DrillFocus,
	level: CefrLevel
) {
	return (
		family.supports.includes(focus) &&
		drillLevelRank(level) >= drillLevelRank(getDrillFocus(focus).minLevel)
	)
}

type StageWeight = { stage: DrillStage; weight: number; minimum?: number }

function guidedWeights(level: CefrLevel): StageWeight[] {
	if (level === 'A1') {
		return [
			{ stage: 'meet', weight: 1, minimum: 1 },
			{ stage: 'retrieve', weight: 7 },
			{ stage: 'switch', weight: 5 },
			{ stage: 'polarity', weight: 4 },
			{ stage: 'conversation', weight: 3 },
		]
	}
	if (level === 'A2') {
		return [
			{ stage: 'meet', weight: 1, minimum: 1 },
			{ stage: 'retrieve', weight: 5 },
			{ stage: 'switch', weight: 4 },
			{ stage: 'polarity', weight: 3 },
			{ stage: 'pronoun', weight: 3 },
			{ stage: 'time', weight: 2 },
			{ stage: 'conversation', weight: 2 },
		]
	}
	return [
		{ stage: 'meet', weight: 1, minimum: 1 },
		{ stage: 'retrieve', weight: 4 },
		{ stage: 'switch', weight: 3 },
		{ stage: 'polarity', weight: 2 },
		{ stage: 'pronoun', weight: 4 },
		{ stage: 'time', weight: 3 },
		{ stage: 'conversation', weight: 3 },
	]
}

function focusWeights(focus: DrillFocus, level: CefrLevel): StageWeight[] {
	if (focus === 'guided') return guidedWeights(level)
	if (focus === 'forms') {
		return [
			{ stage: 'meet', weight: 1, minimum: 1 },
			{ stage: 'retrieve', weight: 4 },
			{ stage: 'switch', weight: 11 },
			{ stage: 'conversation', weight: 4 },
		]
	}
	if (focus === 'polarity') {
		return [
			{ stage: 'meet', weight: 1, minimum: 1 },
			{ stage: 'retrieve', weight: 4 },
			{ stage: 'polarity', weight: 11 },
			{ stage: 'conversation', weight: 4 },
		]
	}
	if (focus === 'pronouns') {
		return [
			{ stage: 'meet', weight: 1, minimum: 1 },
			{ stage: 'retrieve', weight: 3 },
			{ stage: 'switch', weight: 2 },
			{ stage: 'pronoun', weight: 10 },
			{ stage: 'time', weight: 2 },
			{ stage: 'conversation', weight: 2 },
		]
	}
	if (focus === 'time-shifts') {
		return [
			{ stage: 'meet', weight: 1, minimum: 1 },
			{ stage: 'retrieve', weight: 3 },
			{ stage: 'switch', weight: 2 },
			{ stage: 'pronoun', weight: 2 },
			{ stage: 'time', weight: 10 },
			{ stage: 'conversation', weight: 2 },
		]
	}
	return [
		{ stage: 'meet', weight: 1, minimum: 1 },
		{ stage: 'retrieve', weight: 4 },
		{ stage: 'switch', weight: 3 },
		{ stage: 'conversation', weight: 12 },
	]
}

export function getDrillStagePlan(
	level: CefrLevel,
	focus: DrillFocus,
	count: number
) {
	const target = Math.max(20, Math.min(30, Math.round(count)))
	const weights = focusWeights(focus, level)
	const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0)
	const allocations = weights.map((item) => {
		const exact = (item.weight / totalWeight) * target
		const base = Math.max(item.minimum ?? 0, Math.floor(exact))
		return { ...item, exact, count: base }
	})
	let assigned = allocations.reduce((sum, item) => sum + item.count, 0)
	while (assigned < target) {
		const next = [...allocations].sort(
			(a, b) => b.exact - b.count - (a.exact - a.count)
		)[0]
		next.count += 1
		assigned += 1
	}
	while (assigned > target) {
		const next = [...allocations]
			.filter((item) => item.count > (item.minimum ?? 0))
			.sort((a, b) => a.exact - a.count - (b.exact - b.count))[0]
		if (!next) break
		next.count -= 1
		assigned -= 1
	}
	return allocations.flatMap((item) =>
		Array.from({ length: item.count }, () => item.stage)
	)
}

export function getDrillGenerationBrief(
	familyId: DrillFamilyId,
	level: CefrLevel,
	focus: DrillFocus,
	count: number
) {
	const family = getDrillFamily(familyId)
	const stagePlan = getDrillStagePlan(level, focus, count)
	return {
		family,
		level,
		focus: getDrillFocus(focus),
		stagePlan,
		stageCounts: stagePlan.reduce<Record<string, number>>((counts, stage) => {
			counts[stage] = (counts[stage] ?? 0) + 1
			return counts
		}, {}),
	}
}

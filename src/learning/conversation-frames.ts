import type { CefrLevel } from '@/learning/content'
import { clampProgramWeek } from '@/learning/curriculum'

export type CommunicativeFunction =
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

export type TenseFocus =
	| 'present'
	| 'modal-infinitive'
	| 'imperative'
	| 'passato-prossimo'
	| 'imperfect'
	| 'future'
	| 'conditional'
	| 'subjunctive-chunk'

export type RecognitionOnlyTense =
	| 'passato-remoto'
	| 'trapassato'
	| 'full-subjunctive-paradigm'

export type VocabDomain =
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

export type ConversationFrame = {
	id: string
	label: string
	communicativeFunction: CommunicativeFunction
	tenseFocus: TenseFocus
	vocabDomain: VocabDomain
	weeks: [number, number]
	cefrLevels: CefrLevel[]
	maxWords: number
	utilityScore: number
	seedEnglish: string
	seedItalian: string
	slotHints: string[]
	tags: string[]
}

export type GenerationFrame = Pick<
	ConversationFrame,
	| 'id'
	| 'label'
	| 'communicativeFunction'
	| 'tenseFocus'
	| 'vocabDomain'
	| 'maxWords'
	| 'utilityScore'
	| 'seedEnglish'
	| 'seedItalian'
	| 'slotHints'
	| 'tags'
> & { cefrLevel: CefrLevel }

export const recognitionOnlyTenses: RecognitionOnlyTense[] = [
	'passato-remoto',
	'trapassato',
	'full-subjunctive-paradigm',
]

export const spokenCoreSpiral = [
	{
		weeks: [1, 4] as [number, number],
		activeTenses: ['present'] as TenseFocus[],
		label: "Present, questions, possessives, c'è / ci sono",
	},
	{
		weeks: [5, 8] as [number, number],
		activeTenses: ['present', 'modal-infinitive', 'imperative'] as TenseFocus[],
		label: 'Modal verbs, infinitives, and everyday requests',
	},
	{
		weeks: [9, 12] as [number, number],
		activeTenses: ['present', 'modal-infinitive', 'passato-prossimo'] as TenseFocus[],
		label: 'Passato prossimo and simple time phrases',
	},
	{
		weeks: [13, 16] as [number, number],
		activeTenses: [
			'present',
			'passato-prossimo',
			'imperfect',
			'modal-infinitive',
		] as TenseFocus[],
		label: 'Imperfect, passato prossimo, and practical pronouns',
	},
	{
		weeks: [17, 20] as [number, number],
		activeTenses: [
			'present',
			'passato-prossimo',
			'future',
			'conditional',
		] as TenseFocus[],
		label: 'Future plans, conditional requests, opinions, and reasons',
	},
	{
		weeks: [21, 24] as [number, number],
		activeTenses: [
			'present',
			'modal-infinitive',
			'passato-prossimo',
			'imperfect',
			'future',
			'conditional',
			'subjunctive-chunk',
		] as TenseFocus[],
		label: 'Mixed tense fluency with common subjunctive chunks',
	},
]

export const conversationFrames: ConversationFrame[] = [
	{
		id: 'request-food-imperative-pass-salt',
		label: 'Ask For Something At The Table',
		communicativeFunction: 'request',
		tenseFocus: 'imperative',
		vocabDomain: 'food',
		weeks: [5, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 5,
		utilityScore: 98,
		seedEnglish: 'Pass me the salt, please.',
		seedItalian: 'Passami il sale, per favore.',
		slotHints: ['sale', 'pane', 'acqua', 'piatto', 'tovagliolo'],
		tags: ['imperative', 'food', 'request'],
	},
	{
		id: 'locate-food-present-table',
		label: 'Say Where Something Is',
		communicativeFunction: 'locate',
		tenseFocus: 'present',
		vocabDomain: 'food',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 6,
		utilityScore: 96,
		seedEnglish: 'It is on the table.',
		seedItalian: 'È sul tavolo.',
		slotHints: ['sul tavolo', 'in cucina', 'vicino al pane', 'accanto a te'],
		tags: ['present', 'location', 'food'],
	},
	{
		id: 'offer-family-modal-help',
		label: 'Offer Practical Help',
		communicativeFunction: 'offer',
		tenseFocus: 'modal-infinitive',
		vocabDomain: 'family',
		weeks: [5, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 97,
		seedEnglish: 'Can I help with dinner?',
		seedItalian: 'Posso aiutare con la cena?',
		slotHints: ['con la cena', 'con i bambini', 'con la spesa', 'adesso'],
		tags: ['modal', 'family', 'offer'],
	},
	{
		id: 'ask-back-family-present-weekend',
		label: 'Ask Back About Family Plans',
		communicativeFunction: 'ask-back',
		tenseFocus: 'present',
		vocabDomain: 'family',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 8,
		utilityScore: 93,
		seedEnglish: 'And what are you doing this weekend?',
		seedItalian: 'E tu che fai questo weekend?',
		slotHints: ['questo weekend', 'stasera', 'domani', 'dopo cena'],
		tags: ['question', 'family', 'present'],
	},
	{
		id: 'refuse-family-present-soft',
		label: 'Refuse Without Closing The Conversation',
		communicativeFunction: 'refuse-politely',
		tenseFocus: 'present',
		vocabDomain: 'family',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 6,
		utilityScore: 95,
		seedEnglish: 'Sorry, I cannot come today.',
		seedItalian: 'Mi dispiace, oggi non posso.',
		slotHints: ['oggi', 'stasera', 'domenica', 'questa volta'],
		tags: ['softening', 'negative', 'family'],
	},
	{
		id: 'repair-travel-present-repeat',
		label: 'Repair A Misunderstanding',
		communicativeFunction: 'repair',
		tenseFocus: 'present',
		vocabDomain: 'travel',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 5,
		utilityScore: 99,
		seedEnglish: 'I did not understand.',
		seedItalian: 'Non ho capito.',
		slotHints: ['puoi ripetere', 'più lentamente', 'qual è il binario'],
		tags: ['repair', 'travel', 'present'],
	},
	{
		id: 'plan-sport-future-match',
		label: 'Make A Simple Future Plan',
		communicativeFunction: 'plan',
		tenseFocus: 'future',
		vocabDomain: 'sport',
		weeks: [17, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 92,
		seedEnglish: 'We will meet after the match.',
		seedItalian: 'Ci vedremo dopo la partita.',
		slotHints: ['dopo la partita', 'domani', 'al bar', 'alle otto'],
		tags: ['future', 'sport', 'plan'],
	},
	{
		id: 'plan-cafe-present-later',
		label: 'Make A Low-Pressure Plan',
		communicativeFunction: 'plan',
		tenseFocus: 'present',
		vocabDomain: 'cafe',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 5,
		utilityScore: 96,
		seedEnglish: 'See you later.',
		seedItalian: 'Ci vediamo dopo.',
		slotHints: ['dopo', 'domani', 'al bar', 'in centro'],
		tags: ['present', 'planning', 'cafe'],
	},
	{
		id: 'narrate-cafe-past-paid',
		label: 'Say What Just Happened',
		communicativeFunction: 'narrate',
		tenseFocus: 'passato-prossimo',
		vocabDomain: 'cafe',
		weeks: [9, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 5,
		utilityScore: 96,
		seedEnglish: 'I have already paid.',
		seedItalian: 'Ho già pagato.',
		slotHints: ['pagato', 'ordinato', 'chiamato', 'chiesto'],
		tags: ['past', 'cafe', 'narrate'],
	},
	{
		id: 'narrate-family-imperfect-childhood',
		label: 'Give Simple Background',
		communicativeFunction: 'narrate',
		tenseFocus: 'imperfect',
		vocabDomain: 'family',
		weeks: [13, 24],
		cefrLevels: ['B1', 'B2', 'C1'],
		maxWords: 8,
		utilityScore: 86,
		seedEnglish: 'When I was little, I played here.',
		seedItalian: 'Da piccolo giocavo qui.',
		slotHints: ['da piccolo', 'da ragazzo', 'spesso', 'qui'],
		tags: ['imperfect', 'family', 'background'],
	},
	{
		id: 'request-cafe-conditional-coffee',
		label: 'Order Politely',
		communicativeFunction: 'request',
		tenseFocus: 'conditional',
		vocabDomain: 'cafe',
		weeks: [17, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 6,
		utilityScore: 98,
		seedEnglish: 'I would like a coffee, please.',
		seedItalian: 'Vorrei un caffè, per favore.',
		slotHints: ['un caffè', 'un cappuccino', "un bicchiere d'acqua", 'il conto'],
		tags: ['conditional', 'cafe', 'request'],
	},
	{
		id: 'react-culture-present-liked',
		label: 'React To A Film Or Event',
		communicativeFunction: 'react',
		tenseFocus: 'present',
		vocabDomain: 'culture',
		weeks: [1, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 6,
		utilityScore: 90,
		seedEnglish: 'I like it, but it is slow.',
		seedItalian: 'Mi piace, ma è lento.',
		slotHints: ['lento', 'interessante', 'troppo lungo', 'divertente'],
		tags: ['opinion', 'culture', 'present'],
	},
	{
		id: 'give-reason-culture-present-because',
		label: 'Give A Short Reason',
		communicativeFunction: 'give-reason',
		tenseFocus: 'present',
		vocabDomain: 'culture',
		weeks: [1, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 9,
		utilityScore: 91,
		seedEnglish: 'I like it because it is simple.',
		seedItalian: 'Mi piace perché è semplice.',
		slotHints: ['semplice', 'chiaro', 'utile', 'troppo lungo'],
		tags: ['reason', 'opinion', 'culture'],
	},
	{
		id: 'react-local-news-subjunctive-chunk',
		label: 'Use A Safe Opinion Chunk',
		communicativeFunction: 'react',
		tenseFocus: 'subjunctive-chunk',
		vocabDomain: 'local-news',
		weeks: [21, 24],
		cefrLevels: ['B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 84,
		seedEnglish: 'I think it is important.',
		seedItalian: 'Penso che sia importante.',
		slotHints: ['importante', 'giusto', 'un problema', 'una buona idea'],
		tags: ['subjunctive-chunk', 'opinion', 'news'],
	},
	{
		id: 'locate-travel-present-platform',
		label: 'Find A Place Or Platform',
		communicativeFunction: 'locate',
		tenseFocus: 'present',
		vocabDomain: 'travel',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 95,
		seedEnglish: 'Where is platform two?',
		seedItalian: "Dov'è il binario due?",
		slotHints: ['binario due', 'bagno', 'uscita', 'fermata'],
		tags: ['question', 'travel', 'location'],
	},
	{
		id: 'request-shopping-modal-try',
		label: 'Ask To Try Or See Something',
		communicativeFunction: 'request',
		tenseFocus: 'modal-infinitive',
		vocabDomain: 'shopping',
		weeks: [5, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 92,
		seedEnglish: 'Can I try this one?',
		seedItalian: 'Posso provare questo?',
		slotHints: ['questo', 'questa giacca', "un'altra taglia", 'il menù'],
		tags: ['modal', 'shopping', 'request'],
	},
	{
		id: 'narrate-home-past-lost',
		label: 'Explain A Small Problem',
		communicativeFunction: 'narrate',
		tenseFocus: 'passato-prossimo',
		vocabDomain: 'home',
		weeks: [9, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 90,
		seedEnglish: 'I lost the keys.',
		seedItalian: 'Ho perso le chiavi.',
		slotHints: ['le chiavi', 'il telefono', 'il biglietto', 'la borsa'],
		tags: ['past', 'home', 'problem'],
	},
	{
		id: 'react-health-present-feel',
		label: 'Say How You Feel',
		communicativeFunction: 'react',
		tenseFocus: 'present',
		vocabDomain: 'health',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 6,
		utilityScore: 94,
		seedEnglish: 'I feel better today.',
		seedItalian: 'Oggi sto meglio.',
		slotHints: ['meglio', 'male', "un po' stanco", 'bene'],
		tags: ['health', 'present', 'react'],
	},
	{
		id: 'ask-back-sport-present-score',
		label: 'Ask About The Game',
		communicativeFunction: 'ask-back',
		tenseFocus: 'present',
		vocabDomain: 'sport',
		weeks: [1, 24],
		cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 89,
		seedEnglish: 'What is the score?',
		seedItalian: 'Qual è il risultato?',
		slotHints: ['risultato', 'partita', 'squadra', 'primo tempo'],
		tags: ['sport', 'question', 'present'],
	},
	{
		id: 'give-reason-food-past-because',
		label: 'Explain A Food Choice',
		communicativeFunction: 'give-reason',
		tenseFocus: 'passato-prossimo',
		vocabDomain: 'food',
		weeks: [9, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 9,
		utilityScore: 90,
		seedEnglish: 'I chose the pasta because it looked good.',
		seedItalian: 'Ho scelto la pasta perché sembrava buona.',
		slotHints: ['la pasta', 'il pesce', 'la pizza', 'sembrava buona'],
		tags: ['past', 'reason', 'food'],
	},
	{
		id: 'offer-travel-future-call',
		label: 'Offer A Next Step',
		communicativeFunction: 'offer',
		tenseFocus: 'future',
		vocabDomain: 'travel',
		weeks: [17, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 6,
		utilityScore: 88,
		seedEnglish: 'I will call you later.',
		seedItalian: 'Ti chiamerò più tardi.',
		slotHints: ['più tardi', 'domani', 'dopo pranzo', 'stasera'],
		tags: ['future', 'travel', 'offer'],
	},
	{
		id: 'request-health-conditional-water',
		label: 'Ask Politely For Care',
		communicativeFunction: 'request',
		tenseFocus: 'conditional',
		vocabDomain: 'health',
		weeks: [17, 24],
		cefrLevels: ['A2', 'B1', 'B2', 'C1'],
		maxWords: 7,
		utilityScore: 91,
		seedEnglish: 'Could I have some water?',
		seedItalian: "Potrei avere un po' d'acqua?",
		slotHints: ["un po' d'acqua", 'una sedia', 'un minuto', 'il conto'],
		tags: ['conditional', 'health', 'request'],
	},
	{
		id: 'repair-travel-b2-correct-detail',
		label: 'Correct One Detail Calmly',
		communicativeFunction: 'repair',
		tenseFocus: 'present',
		vocabDomain: 'travel',
		weeks: [1, 24],
		cefrLevels: ['B2', 'C1'],
		maxWords: 7,
		utilityScore: 95,
		seedEnglish: 'Not exactly: I mean platform three.',
		seedItalian: 'Non proprio: intendo il binario tre.',
		slotHints: ['il binario tre', 'domani mattina', 'dopo pranzo', 'l altro ingresso'],
		tags: ['repair', 'precision', 'travel'],
	},
	{
		id: 'react-culture-b2-qualify-view',
		label: 'Qualify An Opinion',
		communicativeFunction: 'react',
		tenseFocus: 'present',
		vocabDomain: 'culture',
		weeks: [1, 24],
		cefrLevels: ['B2', 'C1'],
		maxWords: 9,
		utilityScore: 94,
		seedEnglish: 'I see your point, but I do not entirely agree.',
		seedItalian: 'Capisco il tuo punto, ma non concordo del tutto.',
		slotHints: ['non concordo del tutto', 'ho qualche dubbio', 'dipende dal contesto'],
		tags: ['opinion', 'qualification', 'culture'],
	},
	{
		id: 'give-reason-family-b2-consequence',
		label: 'Add A Clear Consequence',
		communicativeFunction: 'give-reason',
		tenseFocus: 'present',
		vocabDomain: 'family',
		weeks: [1, 24],
		cefrLevels: ['B2', 'C1'],
		maxWords: 10,
		utilityScore: 92,
		seedEnglish: 'We are late, so I will let them know now.',
		seedItalian: 'Siamo in ritardo, quindi li avviso subito.',
		slotHints: ['quindi li avviso', 'perciò aspettiamo', 'così evitiamo problemi'],
		tags: ['consequence', 'family', 'planning'],
	},
	{
		id: 'plan-sport-b2-condition',
		label: 'Make A Conditional Plan',
		communicativeFunction: 'plan',
		tenseFocus: 'conditional',
		vocabDomain: 'sport',
		weeks: [17, 24],
		cefrLevels: ['B2', 'C1'],
		maxWords: 8,
		utilityScore: 89,
		seedEnglish: 'I would come, provided I finish in time.',
		seedItalian: 'Verrei, purché finisca in tempo.',
		slotHints: ['purché finisca', 'se trovo un biglietto', 'a meno che piova'],
		tags: ['conditional', 'condition', 'sport'],
	},
	{
		id: 'react-family-c1-honest-qualification',
		label: 'State A Careful Reservation',
		communicativeFunction: 'react',
		tenseFocus: 'present',
		vocabDomain: 'family',
		weeks: [1, 24],
		cefrLevels: ['C1'],
		maxWords: 10,
		utilityScore: 91,
		seedEnglish: 'To be honest, I am not entirely convinced.',
		seedItalian: 'A dire il vero, non ne sono del tutto convinto.',
		slotHints: ['a dire il vero', 'non ne sono convinto', 'avrei qualche riserva'],
		tags: ['stance', 'qualification', 'family'],
	},
	{
		id: 'repair-home-c1-reformulate',
		label: 'Reformulate The Main Point',
		communicativeFunction: 'repair',
		tenseFocus: 'present',
		vocabDomain: 'home',
		weeks: [1, 24],
		cefrLevels: ['C1'],
		maxWords: 8,
		utilityScore: 90,
		seedEnglish: 'In other words, we need a different approach.',
		seedItalian: 'In altre parole, serve un approccio diverso.',
		slotHints: ['in altre parole', 'detto altrimenti', 'il punto è che'],
		tags: ['reformulation', 'repair', 'home'],
	},
	{
		id: 'react-culture-c1-distinction',
		label: 'Make A Useful Distinction',
		communicativeFunction: 'react',
		tenseFocus: 'present',
		vocabDomain: 'culture',
		weeks: [1, 24],
		cefrLevels: ['C1'],
		maxWords: 10,
		utilityScore: 88,
		seedEnglish: 'The point is not what we choose, but why.',
		seedItalian: 'Il punto non è cosa scegliamo, ma perché.',
		slotHints: ['il punto non è', 'la differenza sta in', 'conta soprattutto'],
		tags: ['distinction', 'stance', 'culture'],
	},
	{
		id: 'react-news-c1-limit-claim',
		label: 'Limit A Claim Carefully',
		communicativeFunction: 'react',
		tenseFocus: 'present',
		vocabDomain: 'local-news',
		weeks: [17, 24],
		cefrLevels: ['C1'],
		maxWords: 9,
		utilityScore: 90,
		seedEnglish: 'As far as I know, it has not been decided yet.',
		seedItalian: 'Per quanto ne so, non è ancora deciso.',
		slotHints: ['per quanto ne so', 'a quanto pare', 'salvo nuove informazioni'],
		tags: ['qualification', 'news', 'stance'],
	},
]

const functionByAction: Record<string, CommunicativeFunction[]> = {
	'Ask opinion': ['ask-back', 'react'],
	'Ask follow-up': ['ask-back'],
	'Disagree softly': ['refuse-politely', 'react'],
	'Offer help': ['offer'],
	'Tell a story': ['narrate'],
	'Ask advice': ['request', 'ask-back'],
	'Describe taste': ['react', 'give-reason'],
	Summarise: ['narrate'],
	Repeat: ['repair'],
	Confirm: ['ask-back', 'locate'],
	'Plan next time': ['plan'],
	Compare: ['react', 'give-reason'],
	React: ['react'],
	Invite: ['plan', 'request'],
	Ask: ['request', 'locate'],
	Solve: ['repair', 'locate'],
	'Ask view': ['ask-back', 'react'],
	'Explain why': ['give-reason'],
	'Read headline': ['narrate'],
}

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

export function functionsForAction(action?: string) {
	if (!action) return undefined
	const mapped = functionByAction[action]
	if (mapped) return mapped
	const canonical = Object.entries(actionByFunction).find(
		([, label]) => label === action
	)?.[0] as CommunicativeFunction | undefined
	return canonical ? [canonical] : undefined
}

export function actionMatchesFunction(
	action: string | undefined,
	communicativeFunction: CommunicativeFunction | undefined
) {
	const functions = functionsForAction(action)
	return (
		!functions ||
		!communicativeFunction ||
		functions.includes(communicativeFunction)
	)
}

export function actionForFunction(
	communicativeFunction?: CommunicativeFunction
) {
	return communicativeFunction
		? actionByFunction[communicativeFunction]
		: 'Build a useful response'
}

export function communicativeFunctionLabel(
	communicativeFunction?: CommunicativeFunction
) {
	return actionForFunction(communicativeFunction)
}

function levelRank(level: CefrLevel) {
	return ['A1', 'A2', 'B1', 'B2', 'C1'].indexOf(level)
}

function levelAllowed(frame: ConversationFrame, targetLevel?: CefrLevel) {
	if (!targetLevel) return true
	const targetRank = levelRank(targetLevel)
	return frame.cefrLevels.some((level) => levelRank(level) <= targetRank)
}

function introducedAt(frame: ConversationFrame) {
	return frame.cefrLevels[0]
}

function weekAllowed(frame: ConversationFrame, week: number) {
	return week >= frame.weeks[0] && week <= frame.weeks[1]
}

export function countItalianWords(value: string) {
	return value
		.replace(/[.,!?;:()]/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length
}

export function getActiveTenseFocusesForWeek(week: number): TenseFocus[] {
	const safeWeek = clampProgramWeek(week)
	const stage =
		spokenCoreSpiral.find(
			(item) => safeWeek >= item.weeks[0] && safeWeek <= item.weeks[1]
		) ?? spokenCoreSpiral[0]
	return stage.activeTenses
}

export function getSpokenCoreLabelForWeek(week: number) {
	const safeWeek = clampProgramWeek(week)
	return (
		spokenCoreSpiral.find(
			(item) => safeWeek >= item.weeks[0] && safeWeek <= item.weeks[1]
		)?.label ?? spokenCoreSpiral[0].label
	)
}

export function getFrameById(id?: string) {
	if (!id) return undefined
	return conversationFrames.find((frame) => frame.id === id)
}

export function getConversationFramesForWeek(
	week: number,
	options: {
		targetLevel?: CefrLevel
		action?: string
		domains?: VocabDomain[]
		tenseFocuses?: TenseFocus[]
		communicativeFunctions?: CommunicativeFunction[]
		limit?: number
	} = {}
) {
	const safeWeek = clampProgramWeek(week)
	const activeTenses = new Set(getActiveTenseFocusesForWeek(safeWeek))
	const actionFunctions = functionsForAction(options.action)
	const domainSet = options.domains?.length ? new Set(options.domains) : null
	const tenseSet = options.tenseFocuses?.length
		? new Set(options.tenseFocuses)
		: null
	const functionSet = options.communicativeFunctions?.length
		? new Set(options.communicativeFunctions)
		: null

	const eligible = conversationFrames
		.filter((frame) => weekAllowed(frame, safeWeek))
		.filter((frame) => activeTenses.has(frame.tenseFocus))
		.filter((frame) => !tenseSet || tenseSet.has(frame.tenseFocus))
		.filter((frame) => levelAllowed(frame, options.targetLevel))
		.filter((frame) => !domainSet || domainSet.has(frame.vocabDomain))
		.filter(
			(frame) =>
				!functionSet || functionSet.has(frame.communicativeFunction)
		)
	const actionEligible = actionFunctions?.length
		? eligible.filter((frame) =>
				actionFunctions.includes(frame.communicativeFunction)
		  )
		: eligible
	const scored = (actionEligible.length ? actionEligible : eligible)
		.map((frame) => {
			const actionScore =
				actionFunctions?.includes(frame.communicativeFunction) ? 30 : 0
			const currentStageScore =
				safeWeek >= frame.weeks[0] &&
				safeWeek <= Math.min(frame.weeks[1], frame.weeks[0] + 5)
					? 6
					: 0
			const targetLevelScore =
				options.targetLevel && introducedAt(frame) === options.targetLevel
					? 36
					: 0
			return {
				frame,
				score:
					frame.utilityScore +
					actionScore +
					currentStageScore +
					targetLevelScore,
			}
		})
		.sort((a, b) => b.score - a.score || a.frame.id.localeCompare(b.frame.id))
		.map((item) => item.frame)

	return scored.slice(0, options.limit ?? 12)
}

export function getGenerationFramesForWeek(
	week: number,
	options: Parameters<typeof getConversationFramesForWeek>[1] = {}
): GenerationFrame[] {
	return getConversationFramesForWeek(week, options).map((frame) => ({
		id: frame.id,
		label: frame.label,
		communicativeFunction: frame.communicativeFunction,
		tenseFocus: frame.tenseFocus,
		vocabDomain: frame.vocabDomain,
		maxWords: frame.maxWords,
		utilityScore: frame.utilityScore,
		cefrLevel:
			options.targetLevel && frame.cefrLevels.includes(options.targetLevel)
				? options.targetLevel
				: introducedAt(frame),
		seedEnglish: frame.seedEnglish,
		seedItalian: frame.seedItalian,
		slotHints: frame.slotHints,
		tags: frame.tags,
	}))
}

const matrixSeeds: Record<
	TenseFocus,
	Array<{
		english: string
		italian: string
		communicativeFunction: CommunicativeFunction
	}>
> = {
	present: [
		{ english: 'And what do you think?', italian: 'E tu che cosa ne pensi?', communicativeFunction: 'ask-back' },
		{ english: 'It is here.', italian: 'È qui.', communicativeFunction: 'locate' },
		{ english: 'I like it.', italian: 'Mi piace.', communicativeFunction: 'react' },
		{ english: 'I like it because it is useful.', italian: 'Mi piace perché è utile.', communicativeFunction: 'give-reason' },
		{ english: 'I did not understand.', italian: 'Non ho capito.', communicativeFunction: 'repair' },
	],
	'modal-infinitive': [
		{ english: 'Can I help?', italian: 'Posso aiutare?', communicativeFunction: 'offer' },
		{ english: 'Can you help me?', italian: 'Puoi aiutarmi?', communicativeFunction: 'request' },
		{ english: 'I have to leave now.', italian: 'Devo partire adesso.', communicativeFunction: 'plan' },
		{ english: 'Do you want to come with us?', italian: 'Vuoi venire con noi?', communicativeFunction: 'ask-back' },
		{ english: 'Can you repeat that?', italian: 'Puoi ripeterlo?', communicativeFunction: 'repair' },
	],
	imperative: [
		{ english: 'Tell me, please.', italian: 'Dimmi, per favore.', communicativeFunction: 'request' },
		{ english: 'Wait a moment.', italian: 'Aspetta un momento.', communicativeFunction: 'request' },
		{ english: 'Come with us.', italian: 'Vieni con noi.', communicativeFunction: 'plan' },
		{ english: 'Let me know later.', italian: 'Fammi sapere dopo.', communicativeFunction: 'ask-back' },
		{ english: 'Listen to me for a moment.', italian: 'Ascoltami un momento.', communicativeFunction: 'repair' },
	],
	'passato-prossimo': [
		{ english: 'I have already done it.', italian: "L'ho già fatto.", communicativeFunction: 'narrate' },
		{ english: 'I called this morning.', italian: 'Ho chiamato stamattina.', communicativeFunction: 'narrate' },
		{ english: 'We arrived late.', italian: 'Siamo arrivati tardi.', communicativeFunction: 'narrate' },
		{ english: 'I saw them yesterday.', italian: 'Li ho visti ieri.', communicativeFunction: 'narrate' },
		{ english: 'I liked it very much.', italian: 'Mi è piaciuto molto.', communicativeFunction: 'react' },
	],
	imperfect: [
		{ english: 'I often came here.', italian: 'Venivo spesso qui.', communicativeFunction: 'narrate' },
		{ english: 'We always ate together.', italian: 'Mangiavamo sempre insieme.', communicativeFunction: 'narrate' },
		{ english: 'It was quieter before.', italian: 'Prima era più tranquillo.', communicativeFunction: 'react' },
		{ english: 'While I was waiting, I read.', italian: 'Mentre aspettavo, leggevo.', communicativeFunction: 'narrate' },
		{ english: 'I did not know what to say.', italian: 'Non sapevo cosa dire.', communicativeFunction: 'repair' },
	],
	future: [
		{ english: 'We will meet tomorrow.', italian: 'Ci vedremo domani.', communicativeFunction: 'plan' },
		{ english: 'I will call you later.', italian: 'Ti chiamerò più tardi.', communicativeFunction: 'offer' },
		{ english: 'We will decide tonight.', italian: 'Decideremo stasera.', communicativeFunction: 'plan' },
		{ english: 'I will bring it tomorrow.', italian: 'Lo porterò domani.', communicativeFunction: 'offer' },
		{ english: 'We will talk after dinner.', italian: 'Ne parleremo dopo cena.', communicativeFunction: 'plan' },
	],
	conditional: [
		{ english: 'Could you help me?', italian: 'Potresti aiutarmi?', communicativeFunction: 'request' },
		{ english: 'I would like to know more.', italian: 'Vorrei saperne di più.', communicativeFunction: 'request' },
		{ english: 'Could we meet later?', italian: 'Potremmo vederci più tardi?', communicativeFunction: 'plan' },
		{ english: 'I would prefer tomorrow.', italian: 'Preferirei domani.', communicativeFunction: 'refuse-politely' },
		{ english: 'Should I call them?', italian: 'Dovrei chiamarli?', communicativeFunction: 'ask-back' },
	],
	'subjunctive-chunk': [
		{ english: 'I think it is important.', italian: 'Penso che sia importante.', communicativeFunction: 'react' },
		{ english: 'I hope everything goes well.', italian: 'Spero che vada tutto bene.', communicativeFunction: 'react' },
		{ english: 'I do not think it is a problem.', italian: 'Non credo che sia un problema.', communicativeFunction: 'give-reason' },
		{ english: 'It is better that we leave now.', italian: 'È meglio che partiamo adesso.', communicativeFunction: 'plan' },
		{ english: 'I want you to tell me the truth.', italian: 'Voglio che tu mi dica la verità.', communicativeFunction: 'request' },
	],
}

const matrixDomains: VocabDomain[] = [
	'family',
	'food',
	'sport',
	'cafe',
	'travel',
	'home',
	'shopping',
	'health',
	'culture',
	'local-news',
]

const focusTenseDefaults: Record<string, TenseFocus[]> = {
	questions: ['present', 'modal-infinitive'],
	pronouns: ['present', 'passato-prossimo'],
	opinions: ['present', 'conditional'],
	'conversation-repair': ['present', 'modal-infinitive'],
}

const focusFunctionDefaults: Record<string, CommunicativeFunction[]> = {
	'modal-verbs': ['request', 'offer', 'plan'],
	'past-events': ['narrate', 'react'],
	'past-contrast': ['narrate', 'react'],
	pronouns: ['narrate', 'request', 'offer'],
}

const focusTagAliases: Record<string, string[]> = {
	'modal-verbs': ['modal'],
	'past-events': ['past'],
	'past-contrast': ['past', 'imperfect'],
	'future-plans': ['future'],
	'conditional-requests': ['conditional'],
	pronouns: ['pronoun', 'clitic', 'indirect-object'],
	opinions: ['opinion', 'reason'],
	'conversation-repair': ['repair'],
}

export function getSessionGenerationFrames(
	week: number,
	options: Parameters<typeof getConversationFramesForWeek>[1] & {
		sessionFocus?: string
		focusLabel?: string
	} = {}
): GenerationFrame[] {
	const existing = getGenerationFramesForWeek(week, options)
	const focus = options.sessionFocus ?? 'adaptive'
	if (focus === 'adaptive' || focus === 'fluency' || focus === 'vocabulary') {
		return existing
	}

	const tenses =
		options.tenseFocuses?.length
			? options.tenseFocuses
			: focusTenseDefaults[focus] ?? getActiveTenseFocusesForWeek(week)
	const functions =
		options.communicativeFunctions?.length
			? options.communicativeFunctions
			: focusFunctionDefaults[focus]
	const candidates = tenses.flatMap((tense) =>
		matrixSeeds[tense].filter(
			(seed) => !functions?.length || functions.includes(seed.communicativeFunction)
		)
	)
	const usable = candidates.length ? candidates : tenses.flatMap((tense) => matrixSeeds[tense])
	const domains = options.domains?.length ? options.domains : matrixDomains.slice(0, 5)
	const level = options.targetLevel ?? 'B1'
	const maxWords = level === 'A1' || level === 'A2' ? 8 : level === 'B1' ? 10 : 12
	const limit = Math.max(1, options.limit ?? 5)

	return Array.from({ length: limit }, (_, index) => {
		const seed = usable[index % usable.length]
		const domain = domains[index % domains.length]
		const tenseFocus =
			tenses.find((tense) => matrixSeeds[tense].includes(seed)) ?? tenses[0]
		return {
			id: `matrix-${focus}-${tenseFocus}-${seed.communicativeFunction}-${domain}-${index}`,
			label: options.focusLabel ?? 'Useful Spoken Pattern',
			communicativeFunction: seed.communicativeFunction,
			tenseFocus,
			vocabDomain: domain,
			maxWords,
			utilityScore: 94,
			cefrLevel: level,
			seedEnglish: seed.english,
			seedItalian: seed.italian,
			slotHints: [domain, seed.italian],
			tags: [
				focus,
				...(focusTagAliases[focus] ?? []),
				tenseFocus,
				seed.communicativeFunction,
				domain,
			],
		}
	})
}

import type { CefrLevel, Exercise } from '@/learning/content'
import type {
	CommunicativeFunction,
	TenseFocus,
	VocabDomain,
} from '@/learning/conversation-frames'

export type SessionFocus =
	| 'adaptive'
	| 'fluency'
	| 'vocabulary'
	| 'modal-verbs'
	| 'questions'
	| 'past-events'
	| 'past-contrast'
	| 'future-plans'
	| 'conditional-requests'
	| 'pronouns'
	| 'opinions'
	| 'conversation-repair'

export type SessionDomain = 'mixed' | VocabDomain
export type ChallengeMode = 'comfortable' | 'stretch' | 'intensive'
export type ComplexityStep = 1 | 2 | 3 | 4 | 5
export type CueMode = 'model' | 'anchor' | 'english' | 'situation' | 'interaction'

export type SessionFocusDefinition = {
	id: SessionFocus
	label: string
	shortLabel: string
	description: string
	minLevel: CefrLevel
	minimumWeek: number
	tenseFocuses?: TenseFocus[]
	communicativeFunctions?: CommunicativeFunction[]
	tags?: string[]
}

export const sessionFocusDefinitions: SessionFocusDefinition[] = [
	{
		id: 'adaptive',
		label: 'App chooses',
		shortLabel: 'App chooses',
		description: 'Mix due skills, recent mistakes, and one useful stretch target.',
		minLevel: 'A1',
		minimumWeek: 1,
	},
	{
		id: 'fluency',
		label: 'Speak faster',
		shortLabel: 'Fluency',
		description: 'Use familiar language with less support and quicker responses.',
		minLevel: 'A1',
		minimumWeek: 1,
	},
	{
		id: 'vocabulary',
		label: 'Vocabulary in context',
		shortLabel: 'Vocabulary',
		description: 'Learn useful words inside short, familiar sentence frames.',
		minLevel: 'A1',
		minimumWeek: 1,
	},
	{
		id: 'modal-verbs',
		label: 'Can, want, and have to',
		shortLabel: 'Modal verbs',
		description: 'Build quick sentences with potere, volere, and dovere.',
		minLevel: 'A1',
		minimumWeek: 5,
		tenseFocuses: ['modal-infinitive'],
		tags: ['modal'],
	},
	{
		id: 'questions',
		label: 'Questions and follow-ups',
		shortLabel: 'Questions',
		description: 'Ask, clarify, locate, and keep another person talking.',
		minLevel: 'A1',
		minimumWeek: 1,
		communicativeFunctions: ['ask-back', 'locate', 'request'],
		tags: ['question'],
	},
	{
		id: 'past-events',
		label: 'What happened',
		shortLabel: 'Past events',
		description: 'Report short, useful events with the passato prossimo.',
		minLevel: 'A2',
		minimumWeek: 9,
		tenseFocuses: ['passato-prossimo'],
		communicativeFunctions: ['narrate', 'react'],
		tags: ['past'],
	},
	{
		id: 'past-contrast',
		label: 'What happened versus what was happening',
		shortLabel: 'Past contrast',
		description: 'Choose between completed events and background situations.',
		minLevel: 'B1',
		minimumWeek: 13,
		tenseFocuses: ['passato-prossimo', 'imperfect'],
		tags: ['past', 'imperfect'],
	},
	{
		id: 'future-plans',
		label: 'Future plans',
		shortLabel: 'Future',
		description: 'Arrange, predict, and explain what will happen next.',
		minLevel: 'A2',
		minimumWeek: 17,
		tenseFocuses: ['future'],
		communicativeFunctions: ['plan', 'offer'],
		tags: ['future'],
	},
	{
		id: 'conditional-requests',
		label: 'Polite and conditional requests',
		shortLabel: 'Conditional',
		description: 'Ask tactfully with vorrei, potrei, and dovrei.',
		minLevel: 'A2',
		minimumWeek: 17,
		tenseFocuses: ['conditional'],
		communicativeFunctions: ['request', 'refuse-politely', 'plan'],
		tags: ['conditional'],
	},
	{
		id: 'pronouns',
		label: 'People, things, and pronouns',
		shortLabel: 'Pronouns',
		description: 'Use mi, ti, lo, la, gli, and le without stopping to analyse.',
		minLevel: 'A2',
		minimumWeek: 13,
		tags: ['pronoun', 'clitic', 'indirect-object'],
	},
	{
		id: 'opinions',
		label: 'Opinions and reasons',
		shortLabel: 'Opinions',
		description: 'React, agree, soften disagreement, and give a short reason.',
		minLevel: 'A2',
		minimumWeek: 17,
		communicativeFunctions: ['react', 'give-reason', 'refuse-politely'],
		tags: ['opinion', 'reason'],
	},
	{
		id: 'conversation-repair',
		label: 'Keep the conversation going',
		shortLabel: 'Repair phrases',
		description: 'Ask for repetition, clarify meaning, and recover calmly.',
		minLevel: 'A1',
		minimumWeek: 1,
		communicativeFunctions: ['repair', 'ask-back'],
		tags: ['repair'],
	},
]

export const sessionDomains: Array<{ id: SessionDomain; label: string }> = [
	{ id: 'mixed', label: 'Mixed situations' },
	{ id: 'food', label: 'Food' },
	{ id: 'family', label: 'Family' },
	{ id: 'sport', label: 'Sport' },
	{ id: 'cafe', label: 'Cafe' },
	{ id: 'shopping', label: 'Shopping' },
	{ id: 'travel', label: 'Travel' },
	{ id: 'home', label: 'Home' },
	{ id: 'health', label: 'Health' },
	{ id: 'culture', label: 'Culture' },
	{ id: 'local-news', label: 'Local news' },
]

export const challengeModes: Array<{
	id: ChallengeMode
	label: string
	description: string
}> = [
	{
		id: 'comfortable',
		label: 'Steady',
		description: 'Meet each new pattern once, then rebuild it with fading support.',
	},
	{
		id: 'stretch',
		label: 'Stretch',
		description: 'Start from the meaning and climb toward spontaneous replies.',
	},
	{
		id: 'intensive',
		label: 'Intensive',
		description: 'Start from situations, with more conversational transfer turns.',
	},
]

const cefrOrder: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

function levelRank(level: CefrLevel) {
	return cefrOrder.indexOf(level)
}

export function focusDefinition(focus: SessionFocus) {
	return (
		sessionFocusDefinitions.find((definition) => definition.id === focus) ??
		sessionFocusDefinitions[0]
	)
}

export function focusAvailableAtLevel(focus: SessionFocus, level: CefrLevel) {
	return levelRank(level) >= levelRank(focusDefinition(focus).minLevel)
}

export function normaliseSessionFocus(value: unknown): SessionFocus {
	return sessionFocusDefinitions.some((definition) => definition.id === value)
		? (value as SessionFocus)
		: 'adaptive'
}

export function normaliseSessionDomain(value: unknown): SessionDomain {
	return sessionDomains.some((domain) => domain.id === value)
		? (value as SessionDomain)
		: 'mixed'
}

export function normaliseChallengeMode(value: unknown): ChallengeMode {
	return challengeModes.some((mode) => mode.id === value)
		? (value as ChallengeMode)
		: 'stretch'
}

export function effectiveProgramWeek(programWeek: number, focus: SessionFocus) {
	return Math.max(programWeek, focusDefinition(focus).minimumWeek)
}

export function exerciseMatchesSessionIntent(
	exercise: Exercise,
	options: { focus?: SessionFocus; domain?: SessionDomain }
) {
	const focus = options.focus ?? 'adaptive'
	const domain = options.domain ?? 'mixed'
	if (domain !== 'mixed' && exercise.vocabDomain && exercise.vocabDomain !== domain) {
		return false
	}
	if (focus === 'adaptive' || focus === 'fluency' || focus === 'vocabulary') {
		return true
	}

	const definition = focusDefinition(focus)
	const tenseMatch = definition.tenseFocuses?.includes(exercise.tenseFocus as TenseFocus)
	const functionMatch = definition.communicativeFunctions?.includes(
		exercise.communicativeFunction as CommunicativeFunction
	)
	const tagMatch = definition.tags?.some((tag) => exercise.tags.includes(tag))
	return Boolean(tenseMatch || functionMatch || tagMatch)
}

export function deriveSkillId(exercise: Exercise) {
	const raw =
		exercise.frameId ??
		exercise.construction ??
		`${exercise.phraseFamily}:${exercise.tenseFocus ?? exercise.tags[0] ?? 'speech'}`
	const level = exercise.cefrLevel ?? `difficulty-${exercise.difficulty}`
	return `${raw}:${level}`
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

export function skillLabel(exercise: Exercise) {
	return exercise.phraseFamily || exercise.construction || 'Useful spoken pattern'
}

export function cueModeForStep(step: ComplexityStep): CueMode {
	if (step === 1) return 'model'
	if (step === 2) return 'english'
	if (step === 3) return 'english'
	if (step === 4) return 'situation'
	return 'interaction'
}

export function complexityPlan(count: number, challenge: ChallengeMode) {
	const plans: Record<ChallengeMode, ComplexityStep[]> = {
		comfortable: [1, 2, 2, 3, 3, 4, 4, 5, 5, 5],
		stretch: [2, 2, 3, 3, 4, 4, 4, 5, 5, 5],
		intensive: [4, 4, 4, 5, 5, 5, 5, 5, 5, 5],
	}
	const plan = plans[challenge]
	return Array.from({ length: Math.max(0, count) }, (_, index) => {
		const scaledIndex = Math.min(
			plan.length - 1,
			Math.floor((index / Math.max(1, count - 1)) * (plan.length - 1))
		)
		return plan[scaledIndex]
	})
}

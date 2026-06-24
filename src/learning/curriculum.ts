import type { Exercise } from '@/learning/content'
import type { TenseFocus } from '@/learning/conversation-frames'

export type CurriculumStrand =
	| 'input'
	| 'output'
	| 'language-focus'
	| 'fluency'

export type RoundFocus =
	| 'core'
	| 'verbs-frames'
	| 'past-pronouns'
	| 'topics'
	| 'stretch'

export type CurriculumStage = {
	id: string
	weeks: [number, number]
	title: string
	goals: string[]
	structures: string[]
	verbs: string[]
	topics: string[]
	tags: string[]
	phraseFamilies: string[]
	tenseFocuses: TenseFocus[]
}

export const curriculumStages: CurriculumStage[] = [
	{
		id: 'core-sentence-engine',
		weeks: [1, 4],
		title: 'Build Simple Everyday Sentences',
		goals: [
			'Ask and answer simple questions',
			'Talk about family and daily life',
			'Say what belongs to whom',
			'Use short pronouns in real sentences',
		],
		structures: ['questo/questa', 'mio/tuo/suo', 'mi/ti/lo/la', 'c e/ci sono'],
		verbs: ['essere', 'avere', 'fare', 'andare', 'venire', 'stare'],
		topics: ['family', 'everyday living', 'simple questions'],
		tags: ['question', 'article', 'agreement', 'core', 'fare'],
		phraseFamilies: ['Asking follow-up questions', 'Offering help', 'Conversation repair'],
		tenseFocuses: ['present'],
	},
	{
		id: 'modal-engine',
		weeks: [5, 8],
		title: 'Make Plans And Everyday Requests',
		goals: [
			'Say what you can do',
			'Say what you want or need to do',
			'Arrange simple plans with family',
		],
		structures: ['posso venire', 'vuoi uscire', 'deve studiare', 'negative modal questions'],
		verbs: ['uscire', 'comprare', 'leggere', 'scrivere', 'chiamare', 'aiutare'],
		topics: ['routines', 'errands', 'appointments'],
		tags: ['modal', 'planning', 'routine', 'family'],
		phraseFamilies: ['Making plans', 'Inviting', 'Offering help'],
		tenseFocuses: ['present', 'modal-infinitive', 'imperative'],
	},
	{
		id: 'real-life-past',
		weeks: [9, 12],
		title: 'Talk About What Happened',
		goals: [
			'Tell someone what happened recently',
			'Talk about yesterday and last week',
			'Keep short past-tense stories moving',
		],
		structures: ['ho visto', 'sono andato/a', 'l ho chiamato/a', 'non mi ha risposto'],
		verbs: ['vedere', 'fare', 'dire', 'dare', 'mettere', 'trovare', 'capire'],
		topics: ['visits', 'conversations', 'family events', 'problems'],
		tags: ['past', 'auxiliary', 'imperfect'],
		phraseFamilies: ['Telling past events', 'Reacting'],
		tenseFocuses: ['present', 'modal-infinitive', 'passato-prossimo'],
	},
	{
		id: 'pronoun-control',
		weeks: [13, 16],
		title: 'Refer To People And Things Clearly',
		goals: [
			'Say him, her, it, and them without freezing',
			'Say who received or heard something',
			'Use clear forms before compressed forms',
		],
		structures: ['mi ha chiamato', 'le ho dato', 'gli ho detto', 'l ho dato a Maria'],
		verbs: ['dare', 'dire', 'portare', 'chiamare', 'rispondere'],
		topics: ['family messages', 'giving things', 'telling people'],
		tags: ['pronoun', 'clitic', 'indirect-object'],
		phraseFamilies: ['Conversation repair', 'Telling past events'],
		tenseFocuses: [
			'present',
			'modal-infinitive',
			'passato-prossimo',
			'imperfect',
		],
	},
	{
		id: 'future-opinions',
		weeks: [17, 20],
		title: 'Share Plans, Opinions, And Reasons',
		goals: [
			'Talk about future plans',
			'Give a simple opinion',
			'Agree or disagree politely',
		],
		structures: ['penso che', 'secondo me', 'sono d accordo', 'non sono sicuro/a'],
		verbs: ['votare', 'decidere', 'credere', 'pensare', 'sembrare', 'succedere'],
		topics: ['family decisions', 'local issues', 'work/life', 'simple politics'],
		tags: ['opinion', 'news', 'politics', 'future'],
		phraseFamilies: ['Giving opinions', 'Softening', 'Summarising news'],
		tenseFocuses: ['present', 'passato-prossimo', 'future', 'conditional'],
	},
	{
		id: 'complex-phrase-fluency',
		weeks: [21, 24],
		title: 'Speak In Longer Connected Turns',
		goals: [
			'Link ideas into one longer answer',
			'Explain why something matters',
			'Use common polite conditional phrases',
		],
		structures: ['quando', 'perche', 'anche se', 'mentre', 'prima di', 'dopo aver', 'che'],
		verbs: ['vorrei', 'potrei', 'dovrei', 'migliorare', 'cambiare'],
		topics: ['news stories', 'opinions', 'plans', 'past events'],
		tags: ['connector', 'conditional', 'reason', 'stretch'],
		phraseFamilies: ['Making plans', 'Comparing', 'Giving opinions'],
		tenseFocuses: [
			'present',
			'modal-infinitive',
			'passato-prossimo',
			'imperfect',
			'future',
			'conditional',
			'subjunctive-chunk',
		],
	},
]

export const dailySessionPlan = [
	{ id: 'warmup', minutes: 4, label: 'Recall useful chunks' },
	{ id: 'frames', minutes: 12, label: 'Build fast spoken sentences' },
	{ id: 'mixed', minutes: 6, label: 'Mix sentence patterns' },
	{ id: 'mistakes', minutes: 3, label: 'Repair old mistakes' },
	{ id: 'pronunciation', minutes: 3, label: 'Read aloud' },
	{ id: 'input', minutes: 2, label: 'Watch or read and respond' },
] as const

export const roundFocusWeights: Record<RoundFocus, number> = {
	core: 35,
	'verbs-frames': 30,
	'past-pronouns': 20,
	topics: 10,
	stretch: 5,
}

export const roundFocusLabels: Record<RoundFocus, string> = {
	core: 'Core sentence control',
	'verbs-frames': 'Useful verbs and phrase frames',
	'past-pronouns': 'Past events and pronouns',
	topics: 'Topic vocabulary',
	stretch: 'Longer connected speech',
}

export const mistakeScheduleDays = [1, 3, 7]
export const maxOldMistakesPerSession = 3
export const maxRepairPromptsPerConstruction = 4
export const newsUnlockWeek = 17

export function clampProgramWeek(week: number) {
	if (!Number.isFinite(week)) return 1
	return Math.min(24, Math.max(1, Math.round(week)))
}

export function getCurriculumStage(week: number) {
	const safeWeek = clampProgramWeek(week)
	return (
		curriculumStages.find(
			(stage) => safeWeek >= stage.weeks[0] && safeWeek <= stage.weeks[1]
		) ?? curriculumStages[0]
	)
}

export function getSessionPlan(goalMinutes: number) {
	const safeGoal = Math.max(10, goalMinutes || 30)
	const scale = safeGoal / 30
	return dailySessionPlan.map((item) => ({
		...item,
		minutes: Math.max(1, Math.round(item.minutes * scale)),
	}))
}

export function getExerciseRoundFocus(exercise: Exercise): RoundFocus {
	if (exercise.roundFocus) return exercise.roundFocus
	if (exercise.tags.some((tag) => ['conditional', 'connector', 'stretch'].includes(tag))) {
		return 'stretch'
	}
	if (
		exercise.tags.some((tag) => ['past', 'imperfect', 'pronoun', 'clitic'].includes(tag))
	) {
		return 'past-pronouns'
	}
	if (
		exercise.tags.some((tag) => ['news', 'culture', 'politics'].includes(tag)) ||
		['Summarising news', 'Describing taste', 'Comparing'].includes(exercise.phraseFamily)
	) {
		return 'topics'
	}
	if (
		exercise.tags.some((tag) => ['modal', 'planning', 'fare'].includes(tag)) ||
		['Making plans', 'Inviting'].includes(exercise.phraseFamily)
	) {
		return 'verbs-frames'
	}
	return 'core'
}

export function getExerciseStrand(exercise: Exercise): CurriculumStrand {
	if (exercise.strand) return exercise.strand
	if (exercise.phase === 'speak' || exercise.type === 'scene') return 'output'
	if (exercise.phase === 'repair' || exercise.type === 'transform') return 'language-focus'
	if (exercise.type === 'chunk') return 'fluency'
	return 'output'
}

export function getExerciseWeekWindow(exercise: Exercise): [number, number] {
	if (exercise.curriculumWeeks) return exercise.curriculumWeeks
	const focus = getExerciseRoundFocus(exercise)
	if (focus === 'stretch') return [21, 24]
	if (exercise.tags.includes('news') || exercise.tags.includes('politics')) return [17, 24]
	if (focus === 'topics' && exercise.difficulty >= 2) return [17, 24]
	if (exercise.tags.includes('pronoun') || exercise.tags.includes('clitic')) return [13, 24]
	if (exercise.tags.includes('past') || exercise.tags.includes('imperfect')) return [9, 24]
	if (focus === 'verbs-frames') return [5, 24]
	return [1, 24]
}

export function exerciseIsAvailableForWeek(exercise: Exercise, week: number) {
	const safeWeek = clampProgramWeek(week)
	const [start, end] = getExerciseWeekWindow(exercise)
	return safeWeek >= start && safeWeek <= end
}

export function sourceContentUnlocked(week: number) {
	return clampProgramWeek(week) >= newsUnlockWeek
}

export function getExerciseConstruction(exercise: Exercise) {
	if (exercise.construction) return exercise.construction
	const firstTag = exercise.tags[0] ?? 'sentence'
	return `${exercise.phraseFamily}:${firstTag}`
}

import { db, type PronunciationAttempt } from '@/storage/db'

export type PronunciationPassage = {
	id: string
	title: string
	level: 'A2' | 'B1'
	weeks: [number, number]
	text: string
	focus: string[]
	prepCue: string
}

export type PronunciationFeedback = {
	transcript: string
	intelligibilityScore: number
	passageCoverage: number
	rhythmScore: number
	problemSounds: string[]
	missedWords: string[]
	substitutions: Array<{ expected: string; heard: string }>
	shortFeedback: string
	practiceLines: string[]
	provider?: 'openai' | 'deterministic'
	passageId?: string
	createdAt?: string
}

export const pronunciationPassages: PronunciationPassage[] = [
	{
		id: 'core-family-morning',
		title: 'Family morning',
		level: 'A2',
		weeks: [1, 4],
		text: 'Oggi parlo con mia figlia. Le chiedo come sta e poi facciamo colazione insieme.',
		focus: ['open vowels', 'gli', 'steady endings'],
		prepCue: 'Read in two calm chunks. Do not rush the final vowels.',
	},
	{
		id: 'modal-everyday-plan',
		title: 'Everyday plan',
		level: 'A2',
		weeks: [5, 8],
		text: 'Posso venire piu tardi, ma devo prima fare la spesa e chiamare mia madre.',
		focus: ['posso', 'devo', 'fare la spesa'],
		prepCue: 'Keep posso and devo light, then land clearly on the infinitives.',
	},
	{
		id: 'past-real-life',
		title: 'What happened',
		level: 'A2',
		weeks: [9, 12],
		text: 'Ieri sono andato in centro. Ho visto un amico e gli ho raccontato il problema.',
		focus: ['sono andato', 'ho visto', 'gli ho'],
		prepCue: 'Pause after the first sentence, then keep gli ho as one small unit.',
	},
	{
		id: 'pronoun-control',
		title: 'Giving and telling',
		level: 'B1',
		weeks: [13, 16],
		text: 'Ho portato il documento a Maria. Poi le ho detto che poteva leggerlo domani.',
		focus: ['le ho', 'leggerlo', 'documento'],
		prepCue: 'Say the clear version first. Accuracy matters, but flow matters too.',
	},
	{
		id: 'opinion-family-politics',
		title: 'A careful opinion',
		level: 'B1',
		weeks: [17, 20],
		text: 'Secondo me la situazione puo migliorare, pero non sono sicuro che tutti siano d accordo.',
		focus: ['secondo me', 'pero', 'd accordo'],
		prepCue: 'Let secondo me start the opinion gently, then slow down before d accordo.',
	},
	{
		id: 'connected-turn',
		title: 'Connected turn',
		level: 'B1',
		weeks: [21, 24],
		text: 'Quando leggo una notizia, provo a spiegare perche e importante e che cosa cambiera.',
		focus: ['quando', 'perche', 'cosa cambiera'],
		prepCue: 'Make it one connected thought with a small pause after notizia.',
	},
]

export function getPronunciationPassage(programWeek: number) {
	return (
		pronunciationPassages.find(
			(passage) =>
				programWeek >= passage.weeks[0] && programWeek <= passage.weeks[1]
		) ?? pronunciationPassages[0]
	)
}

export function pronunciationScoreLabel(score: number) {
	if (score >= 90) return 'excellent'
	if (score >= 80) return 'clear'
	if (score >= 65) return 'usable'
	if (score >= 45) return 'developing'
	return 'recorded'
}

export async function recordPronunciationAttempt(args: {
	userId: string
	sessionId?: string | null
	dateKey: string
	passage: PronunciationPassage
	feedback: PronunciationFeedback
	activeMs: number
}) {
	const now = new Date().toISOString()
	const attempt: PronunciationAttempt = {
		id: `${args.userId}:pronunciation:${now}:${args.passage.id}`,
		userId: args.userId,
		sessionId: args.sessionId ?? null,
		dateKey: args.dateKey,
		passageId: args.passage.id,
		passageTitle: args.passage.title,
		expectedText: args.passage.text,
		transcript: args.feedback.transcript,
		score: args.feedback.intelligibilityScore,
		passageCoverage: args.feedback.passageCoverage,
		rhythmScore: args.feedback.rhythmScore,
		problemSounds: args.feedback.problemSounds,
		missedWords: args.feedback.missedWords,
		practiceLines: args.feedback.practiceLines,
		provider: args.feedback.provider ?? null,
		activeMs: Math.max(0, Math.round(args.activeMs)),
		createdAt: now,
	}
	await db.pronunciationAttempts.put(attempt)
	return attempt
}

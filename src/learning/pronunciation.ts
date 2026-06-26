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
		id: 'core-table-request',
		title: 'At the table',
		level: 'A2',
		weeks: [1, 4],
		text: 'Mi passi il sale, per favore? E sul tavolo, vicino al pane.',
		focus: ['mi passi', 'sale', 'vicino'],
		prepCue: 'Keep the request friendly and make the final vowels audible.',
	},
	{
		id: 'core-simple-question',
		title: 'Simple question',
		level: 'A2',
		weeks: [1, 4],
		text: 'Dove sono le chiavi? Le ho messe in cucina, ma ora non le trovo.',
		focus: ['dove sono', 'le ho', 'trovo'],
		prepCue: 'Read it as a real question, then slow down for le ho messe.',
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
		id: 'modal-cafe-plan',
		title: 'Before we leave',
		level: 'A2',
		weeks: [5, 8],
		text: 'Devo prendere un caffe prima di partire, ma posso essere veloce.',
		focus: ['devo prendere', 'prima di', 'veloce'],
		prepCue: 'Make devo prendere one smooth phrase and do not rush partire.',
	},
	{
		id: 'modal-family-help',
		title: 'Can I help',
		level: 'A2',
		weeks: [5, 8],
		text: 'Posso aiutarti in cucina? Dopo dobbiamo uscire tutti insieme.',
		focus: ['posso aiutarti', 'dobbiamo uscire', 'insieme'],
		prepCue: 'Keep the modal phrases light and connected.',
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
		id: 'past-family-call',
		title: 'Phone call',
		level: 'A2',
		weeks: [9, 12],
		text: 'Stamattina ho chiamato mio fratello. Mi ha detto che arrivava piu tardi.',
		focus: ['ho chiamato', 'mi ha detto', 'piu tardi'],
		prepCue: 'Use one clean pause between the two short sentences.',
	},
	{
		id: 'past-shopping-problem',
		title: 'Small problem',
		level: 'A2',
		weeks: [9, 12],
		text: 'Ho comprato il pane, pero ho dimenticato il latte e la frutta.',
		focus: ['ho comprato', 'pero', 'dimenticato'],
		prepCue: 'Let pero mark the turn in the sentence.',
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
		id: 'pronoun-salt-table',
		title: 'It is on the table',
		level: 'B1',
		weeks: [13, 16],
		text: 'Il sale e sul tavolo. Lo prendo io e te lo passo subito.',
		focus: ['lo prendo', 'te lo passo', 'subito'],
		prepCue: 'Keep te lo as a small unit, not two heavy words.',
	},
	{
		id: 'pronoun-message',
		title: 'A quick message',
		level: 'B1',
		weeks: [13, 16],
		text: 'Ho scritto a Lucia e le ho spiegato il problema con calma.',
		focus: ['le ho', 'spiegato', 'con calma'],
		prepCue: 'Put a small stress on Lucia, then keep le ho light.',
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
		id: 'opinion-local-issue',
		title: 'Local issue',
		level: 'B1',
		weeks: [17, 20],
		text: 'Penso che il problema sia serio, ma forse possiamo parlarne dopo cena.',
		focus: ['penso che', 'sia serio', 'parlarne'],
		prepCue: 'Do not overthink sia; say the whole chunk smoothly.',
	},
	{
		id: 'opinion-soft-disagree',
		title: 'Soft disagreement',
		level: 'B1',
		weeks: [17, 20],
		text: 'Capisco quello che dici, pero non sono del tutto d accordo.',
		focus: ['capisco', 'pero', 'd accordo'],
		prepCue: 'Sound warm, not defensive. Keep the last phrase slow.',
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
	{
		id: 'connected-family-plan',
		title: 'Family plan',
		level: 'B1',
		weeks: [21, 24],
		text: 'Prima di uscire, voglio controllare se tutti hanno preso le chiavi.',
		focus: ['prima di', 'controllare se', 'le chiavi'],
		prepCue: 'Start slowly, then keep the second half moving.',
	},
	{
		id: 'connected-cultural-plan',
		title: 'Cultural plan',
		level: 'B1',
		weeks: [21, 24],
		text: 'Anche se sono stanco, verrei volentieri al cinema con voi.',
		focus: ['anche se', 'verrei', 'volentieri'],
		prepCue: 'Let anche se introduce the contrast, then relax into verrei.',
	},
]

function matchingPassages(programWeek: number) {
	const matches = pronunciationPassages.filter(
		(passage) => programWeek >= passage.weeks[0] && programWeek <= passage.weeks[1]
	)
	return matches.length ? matches : [pronunciationPassages[0]]
}

function stableHash(value: string) {
	let hash = 2166136261
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

export function getPronunciationPassage(programWeek: number, dateKey?: string) {
	const candidates = matchingPassages(programWeek)
	if (!dateKey || candidates.length === 1) return candidates[0]
	return candidates[stableHash(`${programWeek}:${dateKey}`) % candidates.length]
}

export async function selectPronunciationPassage(
	userId: string,
	programWeek: number,
	dateKey: string
) {
	const candidates = matchingPassages(programWeek)
	if (candidates.length === 1) return candidates[0]
	const attempts = await db.pronunciationAttempts
		.where('userId')
		.equals(userId)
		.toArray()
	const candidateIds = new Set(candidates.map((passage) => passage.id))
	const relevant = attempts.filter((attempt) => candidateIds.has(attempt.passageId))
	const attemptedToday = new Set(
		relevant
			.filter((attempt) => attempt.dateKey === dateKey)
			.map((attempt) => attempt.passageId)
	)
	const pool =
		attemptedToday.size < candidates.length
			? candidates.filter((passage) => !attemptedToday.has(passage.id))
			: candidates
	const stats = new Map<string, { count: number; last: number }>()
	for (const attempt of relevant) {
		const current = stats.get(attempt.passageId) ?? { count: 0, last: 0 }
		stats.set(attempt.passageId, {
			count: current.count + 1,
			last: Math.max(current.last, new Date(attempt.createdAt).getTime()),
		})
	}
	return [...pool].sort((a, b) => {
		const aStats = stats.get(a.id) ?? { count: 0, last: 0 }
		const bStats = stats.get(b.id) ?? { count: 0, last: 0 }
		if (aStats.count !== bStats.count) return aStats.count - bStats.count
		if (aStats.last !== bStats.last) return aStats.last - bStats.last
		return (
			(stableHash(`${dateKey}:${a.id}`) % 1_000_000) -
			(stableHash(`${dateKey}:${b.id}`) % 1_000_000)
		)
	})[0]
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

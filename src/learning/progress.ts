import { exercises, getExercise, type Exercise } from '@/learning/content'
import {
	evaluateAnswer,
	outcomeIsCorrect,
	type EvaluationResult,
} from '@/learning/evaluator'
import {
	createExerciseState,
	scheduleExerciseReview,
} from '@/learning/scheduler'
import { db, type ExerciseState, type MistakeItem } from '@/storage/db'

export type SprintItem = {
	exercise: Exercise
	state: ExerciseState
}

function isDue(iso?: string | null) {
	if (!iso) return true
	return new Date(iso).getTime() <= Date.now()
}

function sortByPriority(a: SprintItem, b: SprintItem) {
	const aDue = a.state.nextDueAt ? new Date(a.state.nextDueAt).getTime() : 0
	const bDue = b.state.nextDueAt ? new Date(b.state.nextDueAt).getTime() : 0
	if (aDue !== bDue) return aDue - bDue
	return a.exercise.difficulty - b.exercise.difficulty
}

export async function ensureExerciseStates(userId: string) {
	const existing = await db.exerciseStates.where('userId').equals(userId).toArray()
	const existingSet = new Set(existing.map((state) => state.exerciseId))
	const toCreate = exercises
		.filter((exercise) => !existingSet.has(exercise.id))
		.map((exercise) => createExerciseState(userId, exercise.id))

	if (toCreate.length) await db.exerciseStates.bulkPut(toCreate)
}

export type SprintOptions = {
	targetLevel?: 'A1' | 'A2' | 'B1'
	sentenceLength?: 'short' | 'medium' | 'long'
}

function difficultyForLevel(level?: SprintOptions['targetLevel']) {
	if (level === 'A1') return 1
	if (level === 'A2') return 2
	return 3
}

function sentenceFitsLength(
	exercise: Exercise,
	length?: SprintOptions['sentenceLength']
) {
	if (!length || length === 'long') return true
	const words = exercise.targetItalian.split(/\s+/).filter(Boolean).length
	if (length === 'short') return words <= 7
	return words <= 11
}

export async function loadDailySprint(
	userId: string,
	limit = 8,
	options: SprintOptions = {}
) {
	await ensureExerciseStates(userId)
	const states = await db.exerciseStates
		.where('userId')
		.equals(userId)
		.and((state) => !state.archived && isDue(state.nextDueAt))
		.toArray()

	const maxDifficulty = difficultyForLevel(options.targetLevel)
	const eligibleExerciseIds = new Set(
		exercises
			.filter((exercise) => exercise.difficulty <= maxDifficulty)
			.filter((exercise) => sentenceFitsLength(exercise, options.sentenceLength))
			.map((exercise) => exercise.id)
	)

	const dueItems: SprintItem[] = states
		.filter((state) => eligibleExerciseIds.has(state.exerciseId))
		.map((state) => {
			const exercise = getExercise(state.exerciseId)
			return exercise ? { exercise, state } : null
		})
		.filter((item): item is SprintItem => Boolean(item))
		.sort(sortByPriority)

	const focusSceneId = dueItems[0]?.exercise.sceneId ?? 'milan-cafe'
	const sameSceneDue = dueItems.filter(
		(item) => item.exercise.sceneId === focusSceneId
	)
	const otherDue = dueItems.filter((item) => item.exercise.sceneId !== focusSceneId)
	const orderedDue = [...sameSceneDue, ...otherDue]
	const dueIds = new Set(dueItems.map((item) => item.exercise.id))
	const topUpItems: SprintItem[] = []

	if (orderedDue.length < limit) {
		const allStates = await db.exerciseStates.where('userId').equals(userId).toArray()
		const stateMap = new Map(allStates.map((state) => [state.exerciseId, state]))
		const sameSceneExercises = exercises.filter(
			(exercise) => exercise.sceneId === focusSceneId
		)
		const restExercises = exercises.filter(
			(exercise) => exercise.sceneId !== focusSceneId
		)
		for (const exercise of [...sameSceneExercises, ...restExercises]) {
			if (dueIds.has(exercise.id)) continue
			if (!eligibleExerciseIds.has(exercise.id)) continue
			const state = stateMap.get(exercise.id)
			if (!state || state.archived) continue
			topUpItems.push({ exercise, state })
			if (orderedDue.length + topUpItems.length >= limit) break
		}
	}

	return [...orderedDue, ...topUpItems].slice(0, limit)
}

export async function submitExerciseAnswer(args: {
	userId: string
	item: SprintItem
	answer: string
	hintsUsed: number
	conceptHintsUsed?: number
	wordBankUsed?: boolean
	mode?: string
	msUsed: number
}) {
	const result = evaluateAnswer(
		args.item.exercise,
		args.answer,
		args.hintsUsed,
		args.msUsed
	)
	const updated = scheduleExerciseReview(args.item.state, result.outcome)

	await db.exerciseStates.put(updated)
	await db.exerciseLogs.add({
		userId: args.userId,
		exerciseId: args.item.exercise.id,
		ts: new Date().toISOString(),
		outcome: result.outcome,
		correct: result.accepted && outcomeIsCorrect(result.outcome) ? 1 : 0,
		msUsed: args.msUsed,
		hintsUsed: args.hintsUsed,
		conceptHintsUsed: args.conceptHintsUsed ?? args.hintsUsed,
		wordBankUsed: args.wordBankUsed ? 1 : 0,
		mode: args.mode ?? 'sentence',
		answer: args.answer,
	})

	if (result.spellingIssues.length > 0) {
		await upsertMisspellings(args.userId, args.item.exercise, result.spellingIssues)
	}

	if (!result.accepted) {
		await upsertMistake(args.userId, args.item.exercise, args.answer, result)
	}

	return { result, updated }
}

async function upsertMisspellings(
	userId: string,
	exercise: Exercise,
	issues: { answer: string; correction: string }[]
) {
	for (const issue of issues) {
		const id = `${userId}:${issue.answer}:${issue.correction}`
		const existing = await db.misspellings.get(id)
		await db.misspellings.put({
			id,
			userId,
			word: issue.answer,
			correction: issue.correction,
			count: (existing?.count ?? 0) + 1,
			firstSeenAt: existing?.firstSeenAt ?? new Date().toISOString(),
			lastSeenAt: new Date().toISOString(),
			exerciseIds: Array.from(
				new Set([...(existing?.exerciseIds ?? []), exercise.id])
			),
		})
	}
}

async function upsertMistake(
	userId: string,
	exercise: Exercise,
	answer: string,
	result: EvaluationResult
) {
	const id = `${userId}:${exercise.id}`
	const existing = await db.mistakes.get(id)
	const mistake: MistakeItem = {
		id,
		userId,
		exerciseId: exercise.id,
		sceneId: exercise.sceneId,
		promptEnglish: exercise.promptEnglish,
		userAnswer: answer,
		correctedItalian: exercise.targetItalian,
		tags: result.errorTags,
		explanation: buildExplanation(exercise),
		status: result.close ? 'reviewing' : 'open',
		nextDueAt: new Date().toISOString(),
		createdAt: existing?.createdAt ?? new Date().toISOString(),
		lastReviewedAt: existing?.lastReviewedAt ?? null,
		attempts: (existing?.attempts ?? 0) + 1,
	}

	await db.mistakes.put(mistake)
}

function buildExplanation(exercise: Exercise) {
	const firstHint = exercise.hints[0]
	if (firstHint) return firstHint
	return `Focus on: ${exercise.tags.join(', ')}.`
}

export async function getFluencySnapshot(userId: string) {
	const logs = await db.exerciseLogs.where('userId').equals(userId).toArray()
	const mistakes = await db.mistakes.where('userId').equals(userId).toArray()
	const misspellings = await db.misspellings.where('userId').equals(userId).toArray()
	const total = logs.length
	const correct = logs.filter((log) => log.correct).length
	const averageMs = total
		? Math.round(logs.reduce((sum, log) => sum + log.msUsed, 0) / total)
		: 0
	const repaired = mistakes.filter((mistake) => mistake.status === 'repaired').length
	const categoryErrors = new Map<string, number>()
	for (const mistake of mistakes) {
		for (const tag of mistake.tags) {
			categoryErrors.set(tag, (categoryErrors.get(tag) ?? 0) + 1)
		}
	}

	return {
		total,
		correct,
		accuracy: total ? Math.round((correct / total) * 100) : 0,
		averageMs,
		openMistakes: mistakes.filter((mistake) => mistake.status !== 'repaired').length,
		repaired,
		conceptHints: logs.reduce(
			(sum, log) => sum + (log.conceptHintsUsed ?? log.hintsUsed ?? 0),
			0
		),
		wordBankHints: logs.filter((log) => log.wordBankUsed).length,
		topMisspellings: misspellings
			.sort((a, b) => b.count - a.count)
			.slice(0, 5)
			.map((item) => ({
				word: item.word,
				correction: item.correction,
				count: item.count,
			})),
		categoryErrors: Array.from(categoryErrors, ([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 8),
	}
}

import {
	exercises,
	getExercise,
	getExerciseAction,
	getExercisePhase,
	getExerciseRepairPrompts,
	sprintPhaseOrder,
	type Exercise,
	type SprintPhase,
} from '@/learning/content'
import {
	clampProgramWeek,
	exerciseIsAvailableForWeek,
	getExerciseConstruction,
	getExerciseRoundFocus,
	maxOldMistakesPerSession,
	maxRepairPromptsPerConstruction,
	mistakeScheduleDays,
	roundFocusWeights,
} from '@/learning/curriculum'
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
import { addDays } from '@/utils/time'

export type SprintItem = {
	exercise: Exercise
	state: ExerciseState
	focusPhase?: SprintPhase
	sourceMistakeId?: string
}

function isDue(iso?: string | null) {
	if (!iso) return true
	return new Date(iso).getTime() <= Date.now()
}

function sortByPriority(a: SprintItem, b: SprintItem) {
	if (a.sourceMistakeId && !b.sourceMistakeId) return -1
	if (b.sourceMistakeId && !a.sourceMistakeId) return 1
	const aDue = a.state.nextDueAt ? new Date(a.state.nextDueAt).getTime() : 0
	const bDue = b.state.nextDueAt ? new Date(b.state.nextDueAt).getTime() : 0
	if (aDue !== bDue) return aDue - bDue
	const aPhase = sprintPhaseOrder.indexOf(a.focusPhase ?? getExercisePhase(a.exercise))
	const bPhase = sprintPhaseOrder.indexOf(b.focusPhase ?? getExercisePhase(b.exercise))
	if (aPhase !== bPhase) return aPhase - bPhase
	return a.exercise.difficulty - b.exercise.difficulty
}

function sortByCurriculumPriority(a: SprintItem, b: SprintItem, week: number) {
	const base = sortByPriority(a, b)
	if (a.sourceMistakeId || b.sourceMistakeId || base !== 0) return base
	const aAvailable = exerciseIsAvailableForWeek(a.exercise, week) ? 0 : 1
	const bAvailable = exerciseIsAvailableForWeek(b.exercise, week) ? 0 : 1
	if (aAvailable !== bAvailable) return aAvailable - bAvailable
	const aWeight = roundFocusWeights[getExerciseRoundFocus(a.exercise)]
	const bWeight = roundFocusWeights[getExerciseRoundFocus(b.exercise)]
	return bWeight - aWeight
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
	sceneAction?: string
	programWeek?: number
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
	const programWeek = clampProgramWeek(options.programWeek ?? 1)
	const states = await db.exerciseStates
		.where('userId')
		.equals(userId)
		.and((state) => !state.archived && isDue(state.nextDueAt))
		.toArray()

	const maxDifficulty = difficultyForLevel(options.targetLevel)
	const eligibleExerciseIds = new Set(
		exercises
			.filter((exercise) => exercise.difficulty <= maxDifficulty)
			.filter((exercise) => exerciseIsAvailableForWeek(exercise, programWeek))
			.filter((exercise) => sentenceFitsLength(exercise, options.sentenceLength))
			.map((exercise) => exercise.id)
	)

	const dueItems: SprintItem[] = states
		.filter((state) => eligibleExerciseIds.has(state.exerciseId))
		.map((state) => {
			const exercise = getExercise(state.exerciseId)
			return exercise ? { exercise, state } : null
		})
		.filter((item): item is NonNullable<typeof item> => Boolean(item))
		.sort((a, b) => sortByCurriculumPriority(a, b, programWeek))

	const focusSceneId = dueItems[0]?.exercise.sceneId ?? 'milan-cafe'
	const actionDue = options.sceneAction
		? dueItems.filter(
				(item) =>
					item.exercise.sceneId === focusSceneId &&
					getExerciseAction(item.exercise) === options.sceneAction
		  )
		: []
	const sameSceneDue = dueItems.filter(
		(item) => item.exercise.sceneId === focusSceneId
	)
	const otherDue = dueItems.filter((item) => item.exercise.sceneId !== focusSceneId)
	const repairItems = await loadMistakeRepairItems(
		userId,
		eligibleExerciseIds,
		focusSceneId
	)
	const orderedDue = orderSprintItems([
		...repairItems,
		...(actionDue.length ? actionDue : sameSceneDue),
		...sameSceneDue,
		...otherDue,
	], programWeek)
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
		const actionExercises =
			options.sceneAction
				? sameSceneExercises.filter(
						(exercise) => getExerciseAction(exercise) === options.sceneAction
				  )
				: []
		for (const exercise of [
			...actionExercises,
			...sameSceneExercises,
			...restExercises,
		]) {
			if (dueIds.has(exercise.id)) continue
			if (!eligibleExerciseIds.has(exercise.id)) continue
			const state = stateMap.get(exercise.id)
			if (!state || state.archived) continue
			topUpItems.push({ exercise, state })
			if (orderedDue.length + topUpItems.length >= limit) break
		}
	}

	return orderSprintItems([...orderedDue, ...topUpItems], programWeek).slice(0, limit)
}

async function loadMistakeRepairItems(
	userId: string,
	eligibleExerciseIds: Set<string>,
	focusSceneId: string
) {
	const mistakes = await db.mistakes
		.where('userId')
		.equals(userId)
		.and(
			(mistake) =>
				mistake.status !== 'repaired' &&
				(!mistake.nextDueAt || isDue(mistake.nextDueAt))
		)
		.toArray()
	const allStates = await db.exerciseStates.where('userId').equals(userId).toArray()
	const stateMap = new Map(allStates.map((state) => [state.exerciseId, state]))

	return mistakes
		.map((mistake) => {
			const exercise = getExercise(mistake.exerciseId)
			const state = stateMap.get(mistake.exerciseId)
			if (!exercise || !state || !eligibleExerciseIds.has(exercise.id)) return null
			return {
				exercise,
				state,
				focusPhase: 'repair' as const,
				sourceMistakeId: mistake.id,
			}
		})
		.filter((item): item is NonNullable<typeof item> => Boolean(item))
		.sort((a, b) => {
			if (a.exercise.sceneId === focusSceneId && b.exercise.sceneId !== focusSceneId) {
				return -1
			}
			if (b.exercise.sceneId === focusSceneId && a.exercise.sceneId !== focusSceneId) {
				return 1
			}
			return sortByPriority(a, b)
		})
		.slice(0, maxOldMistakesPerSession)
}

function orderSprintItems(items: SprintItem[], week = 1) {
	const seen = new Set<string>()
	const unique = items.filter((item) => {
		const key = `${item.sourceMistakeId ?? 'exercise'}:${item.exercise.id}:${
			item.focusPhase ?? getExercisePhase(item.exercise)
		}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	return unique.sort((a, b) => sortByCurriculumPriority(a, b, week))
}

export async function submitExerciseAnswer(args: {
	userId: string
	item: SprintItem
	answer: string
	hintsUsed: number
	conceptHintsUsed?: number
	wordBankUsed?: boolean
	spokenFirst?: boolean
	mode?: string
	msUsed: number
}) {
	const result = await evaluateExerciseAnswer(
		args.item.exercise,
		args.answer,
		args.hintsUsed,
		args.msUsed,
		{
			spokenFirst: args.spokenFirst,
			phase: args.item.focusPhase ?? getExercisePhase(args.item.exercise),
			action: getExerciseAction(args.item.exercise),
		}
	)
	const updated = scheduleExerciseReview(args.item.state, result.outcome)

	await db.exerciseStates.put(updated)
	await db.exerciseLogs.add({
		userId: args.userId,
		exerciseId: args.item.exercise.id,
		ts: new Date().toISOString(),
		outcome: result.outcome,
		correct: result.communicative && outcomeIsCorrect(result.outcome) ? 1 : 0,
		communicative: result.communicative ? 1 : 0,
		msUsed: args.msUsed,
		hintsUsed: args.hintsUsed,
		conceptHintsUsed: args.conceptHintsUsed ?? args.hintsUsed,
		wordBankUsed: args.wordBankUsed ? 1 : 0,
		spokenFirst: args.spokenFirst ? 1 : 0,
		phase: args.item.focusPhase ?? getExercisePhase(args.item.exercise),
		action: getExerciseAction(args.item.exercise),
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

async function evaluateExerciseAnswer(
	exercise: Exercise,
	answer: string,
	hintsUsed: number,
	msUsed: number,
	context?: { spokenFirst?: boolean; phase?: string; action?: string }
) {
	const fallback = evaluateAnswer(exercise, answer, hintsUsed, msUsed)
	if (typeof window === 'undefined') return fallback

	try {
		const response = await fetch('/api/evaluate-answer', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ exercise, answer, context }),
		})
		if (!response.ok) return fallback
		const data = (await response.json()) as Partial<EvaluationResult>
		const accepted = Boolean(data.accepted)
		const communicative = Boolean(data.communicative)
		return {
			...fallback,
			...data,
			accepted,
			communicative,
			close: data.close ?? (!accepted && communicative),
			spellingOnly: data.spellingOnly ?? fallback.spellingOnly,
			outcome: data.outcome ?? (accepted ? fallback.outcome : communicative ? 'hard' : 'again'),
			normalisedAnswer: data.normalisedAnswer ?? fallback.normalisedAnswer,
			message:
				data.message ??
				(accepted
					? fallback.message
					: communicative
					? 'Communicative. Polish it once.'
					: 'Not yet. Use the model sentence, then it will return in Mistake Gym.'),
			errorTags: data.errorTags ?? fallback.errorTags,
			spellingIssues: data.spellingIssues ?? fallback.spellingIssues,
			repairPrompts: data.repairPrompts ?? fallback.repairPrompts,
			correctedItalian: data.correctedItalian ?? fallback.correctedItalian,
			meaning: data.meaning ?? fallback.meaning,
			shortFeedback: data.shortFeedback ?? fallback.shortFeedback,
			confidence: data.confidence ?? fallback.confidence,
		} satisfies EvaluationResult
	} catch {
		return fallback
	}
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
		repairPrompts: getExerciseRepairPrompts(exercise).slice(
			0,
			maxRepairPromptsPerConstruction
		),
		repairStep: existing?.repairStep ?? 0,
		construction: getExerciseConstruction(exercise),
		lastRepairAnswer: existing?.lastRepairAnswer,
		status: result.close ? 'reviewing' : 'open',
		nextDueAt: addDays(new Date(), mistakeScheduleDays[0]).toISOString(),
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

export async function submitMistakeRepair(args: {
	userId: string
	mistake: MistakeItem
	answer: string
	msUsed: number
}) {
	const source = getExercise(args.mistake.exerciseId)
	const repairExercise: Exercise =
		source ??
		({
			id: args.mistake.exerciseId,
			type: 'sentence',
			sceneId: args.mistake.sceneId,
			promptEnglish: args.mistake.promptEnglish,
			targetItalian: args.mistake.correctedItalian,
			acceptedItalian: [args.mistake.correctedItalian],
			hints: [args.mistake.explanation],
			tags: args.mistake.tags,
			phraseFamily: 'Mistake repair',
			difficulty: 2,
			phase: 'repair',
			action: 'Repair',
			repairPrompts: args.mistake.repairPrompts,
		} satisfies Exercise)
	const result = await evaluateExerciseAnswer(
		repairExercise,
		args.answer,
		0,
		args.msUsed,
		{
			spokenFirst: true,
			phase: 'repair',
			action: 'Repair',
		}
	)
	const repaired = result.communicative
	const currentStep = args.mistake.repairStep ?? 0
	const nextStep = repaired ? currentStep + 1 : 0
	const fullyRepaired = repaired && nextStep >= mistakeScheduleDays.length
	const nextDueAt = fullyRepaired
		? null
		: addDays(
				new Date(),
				mistakeScheduleDays[nextStep] ?? mistakeScheduleDays[0]
		  ).toISOString()
	const updated: MistakeItem = {
		...args.mistake,
		status: fullyRepaired ? 'repaired' : 'reviewing',
		lastReviewedAt: new Date().toISOString(),
		nextDueAt,
		repairStep: nextStep,
		attempts: args.mistake.attempts + 1,
		lastRepairAnswer: args.answer,
	}
	await db.mistakes.put(updated)
	await db.exerciseLogs.add({
		userId: args.userId,
		exerciseId: args.mistake.exerciseId,
		ts: new Date().toISOString(),
		outcome: result.outcome,
		correct: result.communicative ? 1 : 0,
		communicative: result.communicative ? 1 : 0,
		msUsed: args.msUsed,
		hintsUsed: 0,
		conceptHintsUsed: 0,
		wordBankUsed: 0,
		spokenFirst: 1,
		phase: 'repair',
		action: 'Repair',
		mode: 'mistake-repair',
		answer: args.answer,
	})
	return { result, updated }
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
	const spokenFirst = logs.filter((log) => log.spokenFirst).length
	const communicative = logs.filter((log) => log.communicative ?? log.correct).length
	const categoryErrors = new Map<string, number>()
	const phraseFamilies = new Map<string, { total: number; communicative: number }>()
	const phaseCounts = new Map<string, number>()
	for (const mistake of mistakes) {
		for (const tag of mistake.tags) {
			categoryErrors.set(tag, (categoryErrors.get(tag) ?? 0) + 1)
		}
	}
	for (const log of logs) {
		const exercise = getExercise(log.exerciseId)
		if (exercise) {
			const current = phraseFamilies.get(exercise.phraseFamily) ?? {
				total: 0,
				communicative: 0,
			}
			current.total += 1
			current.communicative += log.communicative ?? log.correct
			phraseFamilies.set(exercise.phraseFamily, current)
		}
		if (log.phase) phaseCounts.set(log.phase, (phaseCounts.get(log.phase) ?? 0) + 1)
	}

	return {
		total,
		correct,
		accuracy: total ? Math.round((correct / total) * 100) : 0,
		communicativeAccuracy: total ? Math.round((communicative / total) * 100) : 0,
		averageMs,
		openMistakes: mistakes.filter((mistake) => mistake.status !== 'repaired').length,
		repaired,
		spokenFirst,
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
		phraseFamilies: Array.from(
			phraseFamilies,
			([family, value]) => ({
				family,
				total: value.total,
				communicative: value.communicative,
				rate: value.total ? Math.round((value.communicative / value.total) * 100) : 0,
			})
		)
			.sort((a, b) => b.communicative - a.communicative)
			.slice(0, 6),
		phaseCounts: Array.from(phaseCounts, ([phase, count]) => ({ phase, count })),
	}
}

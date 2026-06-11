import { addDays, nowISO } from '@/utils/time'
import type { ExerciseOutcome } from '@/learning/evaluator'
import type { ExerciseState } from '@/storage/db'

export function createExerciseState(
	userId: string,
	exerciseId: string
): ExerciseState {
	return {
		userId,
		exerciseId,
		lastReviewedAt: null,
		nextDueAt: new Date().toISOString(),
		correctCount: 0,
		wrongCount: 0,
		ease: 2.25,
		intervalDays: 0,
		archived: 0,
	}
}

export function scheduleExerciseReview(
	state: ExerciseState,
	outcome: ExerciseOutcome
): ExerciseState {
	let ease = state.ease || 2.25
	let interval = Math.max(0, state.intervalDays || 0)
	let correctCount = state.correctCount || 0
	let wrongCount = state.wrongCount || 0
	let archived: 0 | 1 = state.archived || 0

	if (outcome === 'again') {
		ease = Math.max(1.3, ease - 0.24)
		interval = 0
		wrongCount += 1
		archived = 0
	} else if (outcome === 'hard') {
		ease = Math.max(1.3, ease - 0.08)
		interval = interval <= 1 ? 1 : Math.max(1, Math.round(interval * 1.25))
		correctCount += 1
		archived = 0
	} else if (outcome === 'good') {
		ease = Math.min(3.0, ease + 0.02)
		correctCount += 1
		if (interval < 1) interval = 1
		else if (interval === 1) interval = 3
		else interval = Math.round(interval * ease)
	} else {
		ease = Math.min(3.1, ease + 0.05)
		correctCount += 1
		if (interval < 1) interval = 2
		else if (interval === 1) interval = 4
		else interval = Math.round(interval * (ease + 0.25))
	}

	if (correctCount >= 5 && interval >= 90) archived = 1

	return {
		...state,
		lastReviewedAt: nowISO(),
		nextDueAt:
			interval === 0
				? addDays(new Date(), 0).toISOString()
				: addDays(new Date(), interval).toISOString(),
		correctCount,
		wrongCount,
		ease,
		intervalDays: interval,
		archived,
	}
}

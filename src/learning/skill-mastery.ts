import type { CefrLevel, Exercise } from '@/learning/content'
import {
	deriveSkillId,
	skillLabel,
	type ComplexityStep,
	type CueMode,
	type SessionDomain,
	type SessionFocus,
} from '@/learning/session-focus'
import {
	db,
	type SkillAttempt,
	type SkillMasteryStage,
	type SkillState,
} from '@/storage/db'
import { addDays } from '@/utils/time'

export type SkillAttemptInput = {
	userId: string
	exercise: Exercise
	targetLevel: CefrLevel
	focus: SessionFocus
	domain: SessionDomain
	complexityStep: ComplexityStep
	cueMode: CueMode
	communicative: boolean
	accepted: boolean
	hintsUsed: number
	wordBankUsed: boolean
	spoken: boolean
	responseLatencyMs: number
	utteranceDurationMs?: number
}

function unique(values: string[]) {
	return Array.from(new Set(values.filter(Boolean)))
}

function dateKey(date = new Date()) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

export function skillIsDue(state?: SkillState, now = Date.now()) {
	if (!state?.nextDueAt) return true
	return new Date(state.nextDueAt).getTime() <= now
}

export function createSkillState(
	userId: string,
	exercise: Exercise,
	targetLevel: CefrLevel,
	focus: SessionFocus
): SkillState {
	return {
		userId,
		skillId: deriveSkillId(exercise),
		label: skillLabel(exercise),
		focus,
		level: exercise.cefrLevel ?? targetLevel,
		frameId: exercise.frameId ?? null,
		tenseFocus: exercise.tenseFocus ?? null,
		communicativeFunction: exercise.communicativeFunction ?? null,
		attempts: 0,
		communicativeSuccesses: 0,
		targetSuccesses: 0,
		unassistedSuccesses: 0,
		fastSpokenSuccesses: 0,
		spokenAttempts: 0,
		transferAttempts: 0,
		transferSuccesses: 0,
		totalResponseLatencyMs: 0,
		bestResponseLatencyMs: null,
		contexts: [],
		practiceDates: [],
		masteryStage: 0,
		intervalDays: 0,
		nextDueAt: new Date().toISOString(),
		lastPracticedAt: null,
		archived: 0,
	}
}

function nextMasteryStage(state: SkillState): SkillMasteryStage {
	if (
		state.transferSuccesses >= 2 &&
		state.fastSpokenSuccesses >= 2 &&
		state.contexts.length >= 2 &&
		state.practiceDates.length >= 2
	) {
		return 5
	}
	if (state.fastSpokenSuccesses >= 2) return 4
	if (state.unassistedSuccesses >= 2) return 3
	if (state.targetSuccesses >= 1) return 2
	if (state.communicativeSuccesses >= 1) return 1
	return 0
}

function nextIntervalDays(
	state: SkillState,
	result: { communicative: boolean; accepted: boolean; unassisted: boolean; transfer: boolean }
) {
	if (!result.communicative) return 1
	if (!result.accepted) return 1
	if (!result.unassisted) return Math.max(2, Math.min(4, state.intervalDays || 2))
	if (result.transfer) return Math.max(7, Math.min(60, (state.intervalDays || 3) * 2))
	if (state.intervalDays < 3) return 3
	return Math.min(60, Math.max(4, Math.round(state.intervalDays * 1.8)))
}

export async function recordSkillAttempt(input: SkillAttemptInput) {
	const skillId = deriveSkillId(input.exercise)
	const existing =
		(await db.skillStates.get([input.userId, skillId])) ??
		createSkillState(input.userId, input.exercise, input.targetLevel, input.focus)
	const now = new Date()
	const nowIso = now.toISOString()
	const responseLatencyMs = Math.max(0, Math.round(input.responseLatencyMs || 0))
	const utteranceDurationMs = Math.max(0, Math.round(input.utteranceDurationMs || 0))
	const transfer = input.cueMode === 'situation' || input.cueMode === 'interaction'
	const unassisted =
		input.hintsUsed === 0 &&
		!input.wordBankUsed &&
		input.complexityStep >= 3
	const fastSpokenSuccess =
		input.accepted &&
		unassisted &&
		input.spoken &&
		responseLatencyMs > 0 &&
		responseLatencyMs <= 8_000
	const context =
		input.domain !== 'mixed'
			? input.domain
			: input.exercise.vocabDomain ?? input.exercise.sceneId

	const updatedBase: SkillState = {
		...existing,
		label: skillLabel(input.exercise),
		focus: input.focus,
		level: input.exercise.cefrLevel ?? input.targetLevel,
		frameId: input.exercise.frameId ?? existing.frameId ?? null,
		tenseFocus: input.exercise.tenseFocus ?? existing.tenseFocus ?? null,
		communicativeFunction:
			input.exercise.communicativeFunction ??
			existing.communicativeFunction ??
			null,
		attempts: existing.attempts + 1,
		communicativeSuccesses:
			existing.communicativeSuccesses + (input.communicative ? 1 : 0),
		targetSuccesses: existing.targetSuccesses + (input.accepted ? 1 : 0),
		unassistedSuccesses:
			(existing.unassistedSuccesses ?? 0) +
			(input.accepted && unassisted ? 1 : 0),
		fastSpokenSuccesses:
			(existing.fastSpokenSuccesses ?? 0) + (fastSpokenSuccess ? 1 : 0),
		spokenAttempts: existing.spokenAttempts + (input.spoken ? 1 : 0),
		transferAttempts: existing.transferAttempts + (transfer ? 1 : 0),
		transferSuccesses:
			existing.transferSuccesses + (transfer && input.communicative ? 1 : 0),
		totalResponseLatencyMs:
			existing.totalResponseLatencyMs + (input.spoken ? responseLatencyMs : 0),
		bestResponseLatencyMs:
			input.spoken && responseLatencyMs > 0
				? Math.min(existing.bestResponseLatencyMs ?? responseLatencyMs, responseLatencyMs)
				: existing.bestResponseLatencyMs ?? null,
		contexts: unique([...existing.contexts, context]),
		practiceDates: unique([...existing.practiceDates, dateKey(now)]),
		lastPracticedAt: nowIso,
		archived: 0,
	}
	const intervalDays = nextIntervalDays(existing, {
		communicative: input.communicative,
		accepted: input.accepted,
		unassisted,
		transfer,
	})
	const updated: SkillState = {
		...updatedBase,
		masteryStage: nextMasteryStage(updatedBase),
		intervalDays,
		nextDueAt: addDays(now, intervalDays).toISOString(),
		archived:
			nextMasteryStage(updatedBase) === 5 && intervalDays >= 60 ? 1 : 0,
	}
	const attempt: SkillAttempt = {
		userId: input.userId,
		skillId,
		exerciseId: input.exercise.id,
		ts: nowIso,
		level: input.exercise.cefrLevel ?? input.targetLevel,
		focus: input.focus,
		domain: input.domain,
		context,
		complexityStep: input.complexityStep,
		cueMode: input.cueMode,
		communicative: input.communicative ? 1 : 0,
		targetAccurate: input.accepted ? 1 : 0,
		unassisted: unassisted ? 1 : 0,
		spoken: input.spoken ? 1 : 0,
		responseLatencyMs,
		utteranceDurationMs,
		hintsUsed: input.hintsUsed,
	}

	await db.transaction('rw', db.skillStates, db.skillAttempts, async () => {
		await db.skillStates.put(updated)
		await db.skillAttempts.add(attempt)
	})
	return updated
}

export async function loadSkillStateMap(userId: string) {
	const states = await db.skillStates.where('userId').equals(userId).toArray()
	return new Map(states.map((state) => [state.skillId, state]))
}

export function masteryStageLabel(stage: SkillMasteryStage) {
	return [
		'Not started',
		'Meaning gets through',
		'Accurate with support',
		'Unassisted',
		'Fast and spoken',
		'Transfer-ready',
	][stage]
}

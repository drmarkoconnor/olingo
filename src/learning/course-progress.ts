import type { SpeechEvidence } from '@/storage/db'
import type { EvaluationResult } from '@/learning/evaluator'
import type { CefrLevel } from '@/learning/content'
import { courseLessons, courseStrands, type CourseLesson } from '@/learning/conversation-course'

/** An assessed, confirmed answer. Callers must pass only the current learner's attempts. */
export interface CourseAttempt {
	id: string
	syncedAt?: string
	runId?: string
	answer?: string
	assessment?: EvaluationResult
	speechEvidence?: SpeechEvidence
	userId?: string
	lessonId: string
	turnId: string
	variant: 'base' | 'transfer'
	contextId?: string
	accepted: boolean
	communicative: boolean
	spoken: boolean
	hintsUsed: number
	atISO: string
	flow: 'fluent' | 'hesitant' | 'rebuilt' | 'unreported'
}

export interface CourseLessonProgress {
	lessonId: string
	status: 'new' | 'practising' | 'review' | 'stable'
	attempts: number
	successfulSpokenAttempts: number
	assistedAttempts: number
	typedAttempts: number
	successfulDates: number
	variants: Array<'base' | 'transfer'>
	contexts: string[]
	coveredTurnIds: string[]
	intervalDays: number
	dueAt: string | null
	isDue: boolean
	readyForTransfer: boolean
	stable: boolean
	needsEasyRepair: boolean
	reasons: string[]
}

const DAY = 86_400_000
const intervals = [1, 3, 7, 14] as const

/** App scheduling heuristics, not CEFR certification or a claim of permanent mastery. */
export const courseEvidencePolicy = {
	minimumSuccessfulDates: 2,
	minimumSeparationHours: 24,
	maximumReviewIntervalDays: 14,
	note: 'Readiness requires successful unassisted speech across all lesson turns, both situations and separate days. It is practice evidence, not a CEFR qualification.',
} as const

function instant(value: Date | string): number {
	return value instanceof Date ? value.getTime() : Date.parse(value)
}

function orderedAttempts(attempts: CourseAttempt[], now: Date | string) {
	const ceiling = instant(now)
	const unique = new Map<string, CourseAttempt>()
	for (const attempt of attempts) {
		const time = Date.parse(attempt.atISO)
		if (!attempt.id || !Number.isFinite(time) || time > ceiling) continue
		const existing = unique.get(attempt.id)
		if (!existing || time >= Date.parse(existing.atISO)) unique.set(attempt.id, attempt)
	}
	return [...unique.values()].sort((a, b) => Date.parse(a.atISO) - Date.parse(b.atISO))
}

function independentSuccess(attempt: CourseAttempt) {
	return attempt.accepted && attempt.communicative && attempt.spoken && attempt.hintsUsed === 0
}

function spokenFailure(attempt: CourseAttempt) {
	return attempt.spoken && (!attempt.accepted || !attempt.communicative)
}

function dateCount(attempts: CourseAttempt[]) {
	return new Set(attempts.map(attempt => new Date(attempt.atISO).toISOString().slice(0, 10))).size
}

function separated(attempts: CourseAttempt[]) {
	return attempts.length > 1 && Date.parse(attempts[attempts.length - 1].atISO) - Date.parse(attempts[0].atISO) >= DAY
}

export function lessonProgress(
	lessonOrId: CourseLesson | string,
	attempts: CourseAttempt[],
	now: Date | string = new Date(),
): CourseLessonProgress {
	const lesson = typeof lessonOrId === 'string' ? courseLessons.find(item => item.id === lessonOrId) : lessonOrId
	if (!lesson) throw new Error(`Unknown conversation lesson: ${lessonOrId}`)
	const turnIds = new Set(lesson.turns.map(turn => turn.id))
	const history = orderedAttempts(attempts, now).filter(attempt => attempt.lessonId === lesson.id && turnIds.has(attempt.turnId))
	const successes = history.filter(independentSuccess)
	const failures = history.filter(spokenFailure)
	const lastFailure = failures[failures.length - 1]
	const sinceLapse = lastFailure
		? successes.filter(attempt => Date.parse(attempt.atISO) > Date.parse(lastFailure.atISO))
		: successes
	const coveredTurnIds = [...new Set(successes.map(attempt => attempt.turnId))]
	const variants = [...new Set(successes.map(attempt => attempt.variant))]
	const contexts = [...new Set(successes.map(attempt => attempt.contextId || `${lesson.id}:${attempt.variant}`))]
	const successfulDates = dateCount(successes)
	const allTurns = lesson.turns.length > 0 && coveredTurnIds.length === lesson.turns.length
	const delayedSuccess = successfulDates >= 2 && separated(successes)
	// A lapse lowers current readiness, while retaining historical evidence. Repair is local
	// to the failed turn and needs delayed success again; other lessons are never reset.
	const recovered = !lastFailure || (
		sinceLapse.length >= 2 && separated(sinceLapse) &&
		failures.every(failure => successes.some(attempt => attempt.turnId === failure.turnId && Date.parse(attempt.atISO) > Date.parse(failure.atISO)))
	)
	const stable = allTurns && contexts.length >= 2 && delayedSuccess && recovered
	const spokenHistory = history.filter(attempt => attempt.spoken)
	const recent = spokenHistory.slice(-3)
	const needsEasyRepair = recent.filter(spokenFailure).length >= 2 && Boolean(recent.length && spokenFailure(recent[recent.length - 1]))
	const schedulingEvidence = history.filter(attempt => independentSuccess(attempt) || spokenFailure(attempt))
	const lastEvidence = schedulingEvidence[schedulingEvidence.length - 1]
	const successDaysSinceLapse = dateCount(sinceLapse)
	const intervalDays = stable ? intervals[Math.min(intervals.length - 1, Math.max(0, successDaysSinceLapse - 1))] : 1
	const dueAt = lastEvidence ? new Date(Date.parse(lastEvidence.atISO) + intervalDays * DAY).toISOString() : null
	const isDue = dueAt !== null && Date.parse(dueAt) <= instant(now)
	const reasons: string[] = []
	if (!history.length) reasons.push('New conversation: start with the supported situation.')
	else {
		if (!allTurns) reasons.push(`Independent speech recorded for ${coveredTurnIds.length} of ${lesson.turns.length} turns.`)
		if (contexts.length < 2) reasons.push('Try the changed situation to check transfer beyond the original example.')
		if (!delayedSuccess) reasons.push('Revisit on a separate day, at least 24 hours later, before judging retention.')
		if (!recovered) reasons.push('A recent spoken lapse needs a successful repair and another delayed success.')
		if (stable) reasons.push('Successful independent speech across the lesson, both situations and separate days.')
		if (needsEasyRepair) reasons.push('Two recent spoken difficulties: use a short, supported repair before increasing complexity.')
	}
	if (isDue) reasons.push('A spaced review is due.')
	return {
		lessonId: lesson.id,
		status: !history.length ? 'new' : isDue ? 'review' : stable ? 'stable' : 'practising',
		attempts: history.length,
		successfulSpokenAttempts: successes.length,
		assistedAttempts: history.filter(attempt => attempt.hintsUsed > 0).length,
		typedAttempts: history.filter(attempt => !attempt.spoken).length,
		successfulDates,
		variants,
		contexts,
		coveredTurnIds,
		intervalDays,
		dueAt,
		isDue,
		readyForTransfer: successes.length > 0,
		stable,
		needsEasyRepair,
		reasons,
	}
}

export interface CourseRecommendation {
	lesson: CourseLesson
	variant: 'base' | 'transfer'
	reason: string
	needsEasyRepair: boolean
	repairTurnId?: string
}

export function recommendLesson(level: CefrLevel, attempts: CourseAttempt[], now: Date | string = new Date()): CourseRecommendation | null {
	const candidates = courseLessons.filter(lesson => lesson.level === level)
	if (!candidates.length) return null
	const ordered = orderedAttempts(attempts, now)
	const latest = ordered[ordered.length - 1]
	const rows = candidates.map(lesson => ({ lesson, progress: lessonProgress(lesson, attempts, now) }))
	// Offer a local recovery after genuine deterioration, rather than demoting the learner.
	const repair = rows.find(row => row.lesson.id === latest?.lessonId && row.progress.needsEasyRepair)
	if (repair) return { lesson: repair.lesson, variant: 'base' as const, repairTurnId: latest.turnId, reason: 'A short supported repair will rebuild the last difficult pattern. You can choose a different conversation instead.', needsEasyRepair: true }
	// Avoid making an overdue item an endless gate: after practising it, offer a different
	// strand where possible. The user remains free to select any lesson or level.
	const rotated = rows.filter(row => row.lesson.id !== latest?.lessonId)
	const pool = rotated.length ? rotated : rows
	const due = pool.filter(row => row.progress.isDue).sort((a, b) => Date.parse(a.progress.dueAt!) - Date.parse(b.progress.dueAt!))[0]
	if (due) return { lesson: due.lesson, variant: due.progress.readyForTransfer ? 'transfer' as const : 'base' as const, reason: 'This conversation is due for spaced retrieval. A changed situation checks whether the language transfers.', needsEasyRepair: false }
	const untried = pool.find(row => row.progress.status === 'new')
	if (untried) return { lesson: untried.lesson, variant: 'base' as const, reason: 'A new everyday function broadens your conversational range while reviews remain scheduled.', needsEasyRepair: false }
	const leastRecent = [...pool].sort((a, b) => {
		const last = (lessonId: string) => ordered.filter(attempt => attempt.lessonId === lessonId).slice(-1)[0]?.atISO ?? ''
		return last(a.lesson.id).localeCompare(last(b.lesson.id))
	})[0]
	return { lesson: leastRecent.lesson, variant: leastRecent.progress.readyForTransfer ? 'transfer' as const : 'base' as const, reason: 'Return to a less recent conversation with a changed situation; familiarity alone is not evidence of retention.', needsEasyRepair: false }
}

export function levelReadiness(level: CefrLevel, attempts: CourseAttempt[], now: Date | string = new Date()) {
	const lessons = courseLessons.filter(lesson => lesson.level === level)
	const strands = courseStrands.map(strand => {
		const strandLessons = lessons.filter(lesson => lesson.strandId === strand.id)
		return {
			strandId: strand.id,
			stableLessons: strandLessons.filter(lesson => lessonProgress(lesson, attempts, now).stable).length,
			totalLessons: strandLessons.length,
		}
	})
	const stableLessons = strands.reduce((sum, strand) => sum + strand.stableLessons, 0)
	const coveredStrands = strands.filter(strand => strand.stableLessons > 0).length
	return {
		level,
		stableLessons,
		totalLessons: lessons.length,
		coveredStrands,
		totalStrands: strands.length,
		readyForBroaderChallenge: lessons.length > 0 && stableLessons === lessons.length && coveredStrands === strands.length,
		strands,
		note: 'These are course practice indicators, not a CEFR assessment. Choose your target level explicitly; spoken interaction, listening, reading and writing need broader evidence.',
	}
}

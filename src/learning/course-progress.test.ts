import { describe, expect, it } from 'vitest'
import { courseLessons, courseStrands } from '@/learning/conversation-course'
import { lessonProgress, levelReadiness, recommendLesson, type CourseAttempt } from '@/learning/course-progress'

const lesson = courseLessons.find(item => item.level === 'A1')!
const start = '2026-09-20T09:00:00.000Z'
const nextDay = '2026-09-21T09:00:00.000Z'
const now = '2026-09-22T10:00:00.000Z'

function answer(patch: Partial<CourseAttempt> = {}): CourseAttempt {
	return {
		id: 'answer-1', lessonId: lesson.id, turnId: lesson.turns[0].id,
		variant: 'base', accepted: true, communicative: true, spoken: true,
		hintsUsed: 0, atISO: start, flow: 'fluent', ...patch,
	}
}

function established() {
	return [
		...lesson.turns.map((turn, index) => answer({ id: `base-${index}`, turnId: turn.id })),
		answer({ id: 'transfer-delayed', variant: 'transfer', atISO: nextDay }),
	]
}

describe('conversation course evidence and spaced recommendations', () => {
	it('does not turn repeated same-day accuracy into secure spoken retrieval', () => {
		const attempts = [...established()].map(attempt => ({ ...attempt, atISO: start }))
		const progress = lessonProgress(lesson, attempts, now)
		expect(progress.coveredTurnIds).toHaveLength(lesson.turns.length)
		expect(progress.variants).toHaveLength(2)
		expect(progress.stable).toBe(false)
	})

	it('requires actual speech without hints, and a different situation', () => {
		expect(lessonProgress(lesson, established().map(item => ({ ...item, spoken: false })), now).stable).toBe(false)
		expect(lessonProgress(lesson, established().map(item => ({ ...item, hintsUsed: 1 })), now).stable).toBe(false)
		expect(lessonProgress(lesson, established().map(item => ({ ...item, variant: 'base' })), now).stable).toBe(false)
		expect(lessonProgress(lesson, established(), now).stable).toBe(true)
	})

	it('does not count crossing midnight as delayed practice', () => {
		const attempts = established().map((item, index) => ({ ...item, atISO: index < lesson.turns.length ? '2026-09-20T23:58:00Z' : '2026-09-21T00:02:00Z' }))
		expect(lessonProgress(lesson, attempts, now).successfulDates).toBe(2)
		expect(lessonProgress(lesson, attempts, now).stable).toBe(false)
	})

	it('lowers current readiness after a lapse without deleting past successes', () => {
		const history = [...established(), answer({ id: 'lapse', accepted: false, atISO: '2026-09-22T09:00:00Z' })]
		const progress = lessonProgress(lesson, history, now)
		expect(progress.stable).toBe(false)
		expect(progress.successfulSpokenAttempts).toBe(established().length)
		expect(progress.intervalDays).toBe(1)
		const repaired = [...history,
			answer({ id: 'repair-1', atISO: '2026-09-22T09:05:00Z' }),
			answer({ id: 'repair-2', atISO: '2026-09-23T09:05:00Z' }),
		]
		expect(lessonProgress(lesson, repaired, '2026-09-23T10:00:00Z').stable).toBe(true)
	})

	it('requires repair of the actual failed turn, not unrelated later successes', () => {
		const history = [...established(),
			answer({ id: 'lapse-other-turn', turnId: lesson.turns[1].id, accepted: false, atISO: '2026-09-22T09:00:00Z' }),
			answer({ id: 'unrelated-1', atISO: '2026-09-22T09:05:00Z' }),
			answer({ id: 'unrelated-2', atISO: '2026-09-23T09:05:00Z' }),
		]
		expect(lessonProgress(lesson, history, '2026-09-23T10:00:00Z').stable).toBe(false)
	})

	it('does not let typed or hinted success postpone a spoken review', () => {
		const baseline = lessonProgress(lesson, established(), now)
		const attempts = [...established(), answer({ id: 'typed', spoken: false, atISO: now }), answer({ id: 'hint', hintsUsed: 1, atISO: now })]
		const progress = lessonProgress(lesson, attempts, now)
		expect(progress.dueAt).toBe(baseline.dueAt)
		expect(progress.typedAttempts).toBe(1)
		expect(progress.assistedAttempts).toBe(1)
	})

	it('deduplicates submissions and rejects impossible or unrelated evidence', () => {
		const attempts = [...established(), ...established(),
			answer({ id: 'future', atISO: '2030-01-01T00:00:00Z' }),
			answer({ id: 'bad-date', atISO: 'not-a-date' }),
			answer({ id: 'bad-turn', turnId: 'turn-from-another-lesson' }),
		]
		expect(lessonProgress(lesson, attempts, now).attempts).toBe(established().length)
	})

	it('records hesitation as descriptive evidence, not an invented accuracy penalty', () => {
		const progress = lessonProgress(lesson, established().map(item => ({ ...item, flow: 'unreported' })), now)
		expect(progress.stable).toBe(true)
	})

	it('prioritises overdue speech review but offers rotation after the latest lesson', () => {
		const other = courseLessons.find(item => item.level === 'A1' && item.id !== lesson.id)!
		const history = [answer(), answer({ id: 'other', lessonId: other.id, turnId: other.turns[0].id, atISO: '2026-09-22T09:00:00Z' })]
		const choice = recommendLesson('A1', history, now)
		expect(choice?.lesson.id).toBe(lesson.id)
		expect(choice?.reason).toContain('spaced')
		const rotated = recommendLesson('A1', [answer()], now)
		expect(rotated?.lesson.id).not.toBe(lesson.id)
	})

	it('offers local easy repair after two recent spoken difficulties', () => {
		const history = [answer({ id: 'fail-1', accepted: false }), answer({ id: 'fail-2', accepted: false, atISO: nextDay })]
		const choice = recommendLesson('A1', history, now)
		expect(choice?.needsEasyRepair).toBe(true)
		expect(choice?.lesson.id).toBe(lesson.id)
		expect(choice?.variant).toBe('base')
	})

	it('requires breadth across every strand rather than a high score in one', () => {
		const readiness = levelReadiness('A1', established(), now)
		expect(readiness.coveredStrands).toBe(1)
		expect(readiness.totalStrands).toBe(courseStrands.length)
		expect(readiness.readyForBroaderChallenge).toBe(false)
		expect(readiness.level).toBe('A1')
		expect(readiness.note).toContain('not a CEFR assessment')
	})
})

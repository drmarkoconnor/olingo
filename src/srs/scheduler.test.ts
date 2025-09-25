import { describe, expect, it } from 'vitest'
import { scheduleReview } from './scheduler'

const base = {
	userId: 'u',
	wordId: 'w',
	correctCount: 0,
	wrongCount: 0,
	ease: 2.3,
	intervalDays: 0,
	archived: 0,
} as any

describe('scheduler', () => {
	it('schedules next review further on correct', () => {
		const updated = scheduleReview(base, 'correct')
		expect(updated.intervalDays).toBeGreaterThanOrEqual(1)
		expect(updated.nextDueAt).toBeTruthy()
	})
	it('resets interval on wrong', () => {
		const start = { ...base, intervalDays: 10 }
		const updated = scheduleReview(start, 'wrong')
		expect(updated.intervalDays).toBe(1)
		expect(updated.archived).toBe(0)
	})
})


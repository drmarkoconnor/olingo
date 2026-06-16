import { describe, expect, it } from 'vitest'
import {
	clampProgramWeek,
	getCurriculumStage,
	getSessionPlan,
	newsUnlockWeek,
	sourceContentUnlocked,
} from '@/learning/curriculum'

describe('curriculum program', () => {
	it('clamps program week to the 24-week plan', () => {
		expect(clampProgramWeek(-2)).toBe(1)
		expect(clampProgramWeek(25)).toBe(24)
	})

	it('scales the 30-minute daily session shape', () => {
		const plan = getSessionPlan(30)
		expect(plan.map((item) => item.minutes)).toEqual([5, 8, 10, 4, 3])
		expect(getSessionPlan(15).reduce((sum, item) => sum + item.minutes, 0)).toBeGreaterThan(10)
	})

	it('unlocks news and politics after the everyday base', () => {
		expect(getCurriculumStage(18).id).toBe('future-opinions')
		expect(sourceContentUnlocked(newsUnlockWeek - 1)).toBe(false)
		expect(sourceContentUnlocked(newsUnlockWeek)).toBe(true)
	})

	it('uses learner-facing stage labels rather than internal grammar tags', () => {
		const stage = getCurriculumStage(1)
		expect(stage.title).toBe('Build Simple Everyday Sentences')
		expect(stage.goals).toContain('Ask and answer simple questions')
		expect(stage.goals).not.toContain('present tense')
		expect(stage.goals).not.toContain('possessives')
	})
})

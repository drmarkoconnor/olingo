import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/learning/content'
import {
	complexityPlan,
	deriveSkillId,
	effectiveProgramWeek,
	exerciseMatchesSessionIntent,
	focusAvailableAtLevel,
} from '@/learning/session-focus'

function exercise(overrides: Partial<Exercise> = {}): Exercise {
	return {
		id: 'variation-one',
		type: 'sentence',
		sceneId: 'family-table',
		promptEnglish: 'We will meet tomorrow.',
		targetItalian: 'Ci vedremo domani.',
		acceptedItalian: ['Ci vedremo domani.'],
		hints: [],
		tags: ['future', 'plan'],
		phraseFamily: 'Make A Simple Future Plan',
		difficulty: 2,
		cefrLevel: 'A2',
		frameId: 'plan-future-meet',
		tenseFocus: 'future',
		vocabDomain: 'family',
		communicativeFunction: 'plan',
		...overrides,
	}
}

describe('session intent and complexity', () => {
	it('opens selected skills at an appropriate CEFR level and curriculum point', () => {
		expect(focusAvailableAtLevel('future-plans', 'A1')).toBe(false)
		expect(focusAvailableAtLevel('future-plans', 'A2')).toBe(true)
		expect(effectiveProgramWeek(2, 'future-plans')).toBe(17)
	})

	it('filters by both speaking focus and real-life situation', () => {
		const futureFamily = exercise()
		expect(
			exerciseMatchesSessionIntent(futureFamily, {
				focus: 'future-plans',
				domain: 'family',
			})
		).toBe(true)
		expect(
			exerciseMatchesSessionIntent(futureFamily, {
				focus: 'past-events',
				domain: 'family',
			})
		).toBe(false)
		expect(
			exerciseMatchesSessionIntent(futureFamily, {
				focus: 'future-plans',
				domain: 'sport',
			})
		).toBe(false)
	})

	it('uses one stable skill id for fresh variations of the same levelled frame', () => {
		const first = exercise({ id: 'variation-one' })
		const second = exercise({
			id: 'variation-two',
			promptEnglish: 'We will meet after dinner.',
			targetItalian: 'Ci vedremo dopo cena.',
		})
		expect(deriveSkillId(first)).toBe(deriveSkillId(second))
		expect(deriveSkillId(first)).not.toBe(
			deriveSkillId(exercise({ cefrLevel: 'B1' }))
		)
	})

	it('fades support progressively without requiring longer sentences', () => {
		expect(complexityPlan(10, 'comfortable')).toEqual([
			1, 1, 2, 2, 3, 3, 3, 4, 4, 5,
		])
		expect(complexityPlan(5, 'intensive')).toEqual([2, 3, 4, 5, 5])
	})
})

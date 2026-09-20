import { describe, expect, it } from 'vitest'
import { isCefrLevel, normaliseTargetLevel } from '@/learning/generated-sentences'
import {
	getLevelQuotas,
	adjacentLevel,
	difficultyForCefr,
	levelForDifficulty,
	getLearningProfile,
	selectLevelBalanced,
} from '@/learning/learning-profile'

describe('spoken CEFR learning profile', () => {
	it('supports C2 without inventing a higher CEFR band', () => {
		expect(isCefrLevel('C2')).toBe(true)
		expect(isCefrLevel('C3')).toBe(false)
		expect(normaliseTargetLevel('C2')).toBe('C2')
		expect(difficultyForCefr('C2')).toBe(6)
		expect(levelForDifficulty(6)).toBe('C2')
		expect(adjacentLevel('C1', 1)).toBe('C2')
		expect(adjacentLevel('C2', 1)).toBe('C2')
		expect(getLevelQuotas('C1', 10).stretch).toBe(1)
		expect(getLevelQuotas('C2', 10)).toEqual({ target: 8, consolidation: 2, stretch: 0 })
		expect(getLearningProfile('C2').guidance).toContain('implication')
	})

	it('keeps most practice at the selected level', () => {
		expect(getLevelQuotas('B1', 10)).toEqual({
			target: 7,
			consolidation: 2,
			stretch: 1,
		})
		expect(getLearningProfile('B2').maxWords).toBeLessThanOrEqual(11)
	})

	it('uses the nearest lower level for consolidation', () => {
		const items = [
			{ id: 'c1-a', level: 'C1' as const },
			{ id: 'c1-b', level: 'C1' as const },
			{ id: 'c1-c', level: 'C1' as const },
			{ id: 'a1', level: 'A1' as const },
			{ id: 'b1', level: 'B1' as const },
			{ id: 'b2', level: 'B2' as const },
		]
		const selected = selectLevelBalanced(items, (item) => item.level, 'C1', 4)

		expect(selected.map((item) => item.id)).toEqual([
			'c1-a',
			'c1-b',
			'c1-c',
			'b2',
		])
	})
})

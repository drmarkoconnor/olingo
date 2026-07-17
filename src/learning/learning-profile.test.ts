import { describe, expect, it } from 'vitest'
import {
	getLevelQuotas,
	getLearningProfile,
	selectLevelBalanced,
} from '@/learning/learning-profile'

describe('spoken CEFR learning profile', () => {
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

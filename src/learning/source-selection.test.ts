import { describe, expect, it } from 'vitest'
import {
	advanceVideoSelectionHistory,
	normaliseVideoSelectionHistory,
	rotatedQueryIndexes,
	selectFreshVideos,
} from '../../netlify/functions/_shared/source-selection'

describe('source video rotation', () => {
	it('selects unseen videos before recycling older choices', () => {
		const history = normaliseVideoSelectionHistory(
			{
				seenIds: ['video-1', 'video-2'],
				recentIds: ['video-2'],
				nextQueryIndex: 0,
				batchesShown: 2,
			},
			4
		)
		const result = selectFreshVideos(
			['video-1', 'video-2', 'video-3', 'video-4'].map((id) => ({ id })),
			history,
			3
		)

		expect(result.items.map((item) => item.id)).toEqual([
			'video-3',
			'video-4',
			'video-1',
		])
		expect(result.freshCount).toBe(2)
	})

	it('remembers a shown batch and advances to the next search theme', () => {
		const history = normaliseVideoSelectionHistory(null, 5)
		const next = advanceVideoSelectionHistory(
			history,
			['video-8', 'video-9'],
			3,
			5,
			new Date('2026-08-09T09:00:00Z')
		)

		expect(next.seenIds).toEqual(['video-8', 'video-9'])
		expect(next.recentIds).toEqual(['video-8', 'video-9'])
		expect(next.nextQueryIndex).toBe(4)
		expect(next.batchesShown).toBe(1)
	})

	it('wraps search themes without repeating an index', () => {
		expect(rotatedQueryIndexes(4, 3)).toEqual([3, 0, 1, 2])
	})
})

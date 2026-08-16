import { describe, expect, it } from 'vitest'
import {
	atlasPosition,
	dueMemoryAnchors,
	memoryAnchorRefs,
	memoryCueForLevel,
	memoryExerciseId,
	memoryRooms,
	memoryStatus,
	scheduleMemoryAnchorReview,
} from '@/learning/memory-house'
import type { ExerciseState } from '@/storage/db'

const expectedRoute = [
	'Driveway',
	'Coach House',
	'Loggia',
	'Utility Room',
	'Kitchen',
	'Steep Stairs',
	'Hallway',
	'Study',
	'Drawing Room',
	'Piano Room',
	'Toilet',
	'Dining Room',
	'Lounge',
	'Main Stairs',
	'Charlotte’s Room',
	'Junk Room',
	'Nursery',
	'Ann’s Bedroom',
	'Master Bedroom',
	'Dressing Room',
	'Peloton Room',
	'Main Bathroom',
	'Nanny Nard’s Room',
	'Ensuite',
]

describe('Memory House route', () => {
	it('keeps the requested 24-room journey stable and ordered', () => {
		expect(memoryRooms.map((room) => room.title)).toEqual(expectedRoute)
		expect(memoryAnchorRefs).toHaveLength(48)
		expect(new Set(memoryAnchorRefs.map(({ room, anchor }) => memoryExerciseId(room.id, anchor.id))).size).toBe(48)
	})

	it('keeps every active phrase short enough for fast spoken recall', () => {
		for (const { anchor } of memoryAnchorRefs) {
			expect(anchor.italian.replace(/[.!?]/g, '').split(/\s+/).length).toBeLessThanOrEqual(10)
			expect(anchor.english.length).toBeGreaterThan(0)
			expect(anchor.situation.length).toBeGreaterThan(0)
		}
	})

	it('uses direct translation at A1/A2 and a situation cue from B1', () => {
		const anchor = memoryRooms[4].anchors[0]
		expect(memoryCueForLevel(anchor, 'A2')).toBe(anchor.english)
		expect(memoryCueForLevel(anchor, 'B1')).toBe(anchor.situation)
	})

	it('maps all rooms to the 6 by 4 atlas', () => {
		expect(atlasPosition(0)).toEqual({ column: 0, row: 0 })
		expect(atlasPosition(5)).toEqual({ column: 5, row: 0 })
		expect(atlasPosition(23)).toEqual({ column: 5, row: 3 })
	})
})

describe('Memory House spacing', () => {
	it('does not call unseen anchors due reviews', () => {
		expect(dueMemoryAnchors(new Map())).toEqual([])
		expect(memoryStatus(undefined)).toBe('new')
	})

	it('returns a previously studied anchor when its date is due', () => {
		const ref = memoryAnchorRefs[0]
		const id = memoryExerciseId(ref.room.id, ref.anchor.id)
		const state: ExerciseState = {
			userId: 'test-user',
			exerciseId: id,
			lastReviewedAt: '2026-01-01T00:00:00.000Z',
			nextDueAt: '2026-01-02T00:00:00.000Z',
			correctCount: 1,
			wrongCount: 0,
			ease: 2.25,
			intervalDays: 1,
			archived: 0,
		}
		const states = new Map([[id, state]])
		expect(dueMemoryAnchors(states, new Date('2026-01-03').getTime())).toHaveLength(1)
	})

	it('uses a 1, 3, 7, 14, 30 day retrieval ladder', () => {
		const base: ExerciseState = {
			userId: 'test-user',
			exerciseId: 'memory-house:test',
			correctCount: 1,
			wrongCount: 0,
			ease: 2.25,
			intervalDays: 0,
			archived: 0,
		}
		const now = new Date('2026-01-01T12:00:00.000Z')
		expect(scheduleMemoryAnchorReview(base, true, now).intervalDays).toBe(1)
		expect(scheduleMemoryAnchorReview({ ...base, correctCount: 2 }, true, now).intervalDays).toBe(3)
		expect(scheduleMemoryAnchorReview({ ...base, correctCount: 3 }, true, now).intervalDays).toBe(7)
		expect(scheduleMemoryAnchorReview({ ...base, correctCount: 4 }, true, now).intervalDays).toBe(14)
		expect(scheduleMemoryAnchorReview({ ...base, correctCount: 5 }, true, now).intervalDays).toBe(30)
	})
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	advanceSceneEpisode,
	loadSceneCards,
	sceneEpisodeTargetCount,
} from '@/learning/scene-episodes'
import { db, type ExerciseLog } from '@/storage/db'

const userId = 'scene-user'

beforeEach(async () => {
	await db.delete()
	await db.open()
})

function successfulLog(index: number): ExerciseLog {
	return {
		userId,
		exerciseId: 'cafe-opinion-1',
		ts: new Date(Date.UTC(2026, 5, 14, 10, index)).toISOString(),
		outcome: 'good',
		correct: 1,
		communicative: 1,
		msUsed: 4000,
		hintsUsed: 0,
		mode: 'sentence',
		answer: 'Secondo me, il caffe qui e molto buono.',
	}
}

describe('scene episodes', () => {
	it('opens the everyday scenes first and locks later scenes with reasons', async () => {
		const cards = await loadSceneCards(userId, 1)

		expect(cards.find((scene) => scene.id === 'milan-cafe')?.available).toBe(true)
		expect(cards.find((scene) => scene.id === 'family-table')?.available).toBe(
			true
		)
		expect(cards.find((scene) => scene.id === 'station')?.available).toBe(true)
		expect(cards.find((scene) => scene.id === 'bookshop')?.available).toBe(false)
		expect(cards.find((scene) => scene.id === 'bookshop')?.lockedReason).toContain(
			'cafe'
		)
	})

	it('unlocks the bookshop after enough communicative cafe reps', async () => {
		await db.exerciseLogs.bulkAdd(
			Array.from({ length: sceneEpisodeTargetCount }, (_, index) =>
				successfulLog(index)
			)
		)

		const cards = await loadSceneCards(userId, 1)

		expect(cards.find((scene) => scene.id === 'milan-cafe')?.complete).toBe(true)
		expect(cards.find((scene) => scene.id === 'bookshop')?.available).toBe(true)
	})

	it('creates the next remembered scenario after a scene is complete', async () => {
		await db.exerciseLogs.bulkAdd(
			Array.from({ length: sceneEpisodeTargetCount }, (_, index) =>
				successfulLog(index)
			)
		)
		const before = await loadSceneCards(userId, 1)
		const currentCafe = before.find((scene) => scene.id === 'milan-cafe')!

		const after = await advanceSceneEpisode({
			userId,
			sceneId: 'milan-cafe',
			programWeek: 1,
			targetLevel: 'B1',
		})
		const nextCafe = after.find((scene) => scene.id === 'milan-cafe')!
		const episodes = await db.sceneEpisodes
			.where('userId')
			.equals(userId)
			.and((episode) => episode.baseSceneId === 'milan-cafe')
			.toArray()

		expect(currentCafe.complete).toBe(true)
		expect(nextCafe.scenarioIndex).toBe(currentCafe.scenarioIndex + 1)
		expect(nextCafe.complete).toBe(false)
		expect(episodes).toHaveLength(2)
		expect(episodes.some((episode) => episode.retired === 1)).toBe(true)
	})
})

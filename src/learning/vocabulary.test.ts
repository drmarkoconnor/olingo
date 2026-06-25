import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	getThematicVocabularyForScene,
	loadVocabularyReviewQueue,
	recordVocabularyReview,
} from '@/learning/vocabulary'
import { db } from '@/storage/db'

const userId = 'vocab-user'

beforeEach(async () => {
	await db.delete()
	await db.open()
})

describe('thematic vocabulary review', () => {
	it('expands a scene beyond the tiny fixed showcase list', () => {
		const vocabulary = getThematicVocabularyForScene('milan-cafe', {
			programWeek: 6,
			targetLevel: 'B1',
		})
		const italian = vocabulary.map((item) => item.italian)

		expect(vocabulary.length).toBeGreaterThan(40)
		expect(italian).toContain('il conto')
		expect(italian).toContain('passami')
		expect(italian).toContain('mia madre')
		expect(new Set(vocabulary.map((item) => item.id)).size).toBe(
			vocabulary.length
		)
	})

	it('moves known cards out of the immediate matching queue', async () => {
		const firstQueue = await loadVocabularyReviewQueue(userId, 'milan-cafe', {
			programWeek: 6,
			targetLevel: 'B1',
			limit: 12,
			dateKey: '2026-06-25',
		})
		const firstFour = firstQueue.slice(0, 4)

		for (const card of firstFour) {
			await recordVocabularyReview(userId, card, true)
		}

		const secondQueue = await loadVocabularyReviewQueue(userId, 'milan-cafe', {
			programWeek: 6,
			targetLevel: 'B1',
			limit: 12,
			dateKey: '2026-06-25',
		})
		const secondIds = new Set(secondQueue.slice(0, 4).map((card) => card.id))

		expect(firstFour.every((card) => !secondIds.has(card.id))).toBe(true)
	})

	it('records review logs and schedules vocabulary cards', async () => {
		const [card] = await loadVocabularyReviewQueue(userId, 'family-table', {
			programWeek: 1,
			targetLevel: 'A2',
			limit: 8,
			dateKey: '2026-06-25',
		})

		const updated = await recordVocabularyReview(userId, card, true)
		const logs = await db.reviewLogs.where('userId').equals(userId).toArray()

		expect(updated.correctCount).toBe(1)
		expect(updated.nextDueAt).toBeTruthy()
		expect(logs).toHaveLength(1)
		expect(logs[0].wordId).toBe(card.id)
		expect(logs[0].correct).toBe(1)
	})
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	completeDailySessionUnit,
	getDailySessionProgress,
	getOrCreateDailySession,
	getRevisionAdvice,
	getTodayDateKey,
} from '@/learning/daily-session'
import { db } from '@/storage/db'

const userId = 'daily-user'

beforeEach(async () => {
	await db.delete()
	await db.open()
})

describe('daily session planning', () => {
	it('uses the browser-local calendar day as the session key', () => {
		const date = new Date(2026, 5, 14, 23, 45)
		expect(getTodayDateKey(date)).toBe('2026-06-14')
	})

	it('creates a fixed checklist for the day and reuses it', async () => {
		const first = await getOrCreateDailySession(
			userId,
			{
				programWeek: 1,
				dailyGoal: 30,
				vocabularyCount: 10,
				sentenceCount: 8,
				repairCount: 2,
			},
			'2026-06-14'
		)
		const second = await getOrCreateDailySession(
			userId,
			{
				programWeek: 9,
				dailyGoal: 15,
				vocabularyCount: 3,
				sentenceCount: 3,
				repairCount: 0,
			},
			'2026-06-14'
		)

		expect(first.session.id).toBe(second.session.id)
		expect(first.items.map((item) => item.type)).toEqual([
			'match',
			'recall',
			'sentence',
			'repair',
			'pronunciation',
			'transfer',
		])
		expect(getDailySessionProgress(first.items)).toEqual({
			planned: 26,
			completed: 0,
			percent: 0,
		})
	})

	it('counts units toward a real finish line', async () => {
		const bundle = await getOrCreateDailySession(
			userId,
			{
				programWeek: 1,
				dailyGoal: 30,
				vocabularyCount: 3,
				sentenceCount: 1,
				repairCount: 0,
			},
			'2026-06-14'
		)
		const match = bundle.items.find((item) => item.type === 'match')!

		const afterOne = await completeDailySessionUnit(match.id, {
			activeMs: 1400,
			success: true,
			tags: ['vocab'],
		})

		expect(afterOne.session.completedCount).toBe(1)
		expect(afterOne.session.activeMs).toBe(1400)
		expect(afterOne.items.find((item) => item.id === match.id)?.status).toBe(
			'active'
		)
		expect(getRevisionAdvice(['modal', 'clitic', 'article'])).toEqual([
			'modal verbs',
			'pronoun placement',
			'agreement and articles',
		])
	})

	it('marks the day complete when every required unit is done', async () => {
		let bundle = await getOrCreateDailySession(
			userId,
			{
				programWeek: 1,
				dailyGoal: 30,
				vocabularyCount: 1,
				sentenceCount: 1,
				repairCount: 0,
			},
			'2026-06-14'
		)

		for (const item of bundle.items) {
			for (let index = 0; index < item.targetCount; index += 1) {
				bundle = await completeDailySessionUnit(item.id, {
					activeMs: 500,
					success: true,
				})
			}
		}

		expect(bundle.session.status).toBe('complete')
		expect(bundle.session.completedCount).toBe(bundle.session.plannedCount)
		expect(bundle.session.completedAt).toBeTruthy()
	})
})

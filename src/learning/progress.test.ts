import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getExerciseAction } from '@/learning/content'
import { exerciseIsAvailableForWeek, sourceContentUnlocked } from '@/learning/curriculum'
import { saveGeneratedExercises } from '@/learning/generated-sentences'
import {
	ensureExerciseStates,
	loadDailySprint,
	submitMistakeRepair,
} from '@/learning/progress'
import { db, type MistakeItem } from '@/storage/db'

const userId = 'test-user'

beforeEach(async () => {
	await db.delete()
	await db.open()
})

describe('daily sprint composition', () => {
	it('includes exercises for the selected scene action', async () => {
		await ensureExerciseStates(userId)
		const queue = await loadDailySprint(userId, 8, {
			targetLevel: 'B1',
			sentenceLength: 'long',
			sceneAction: 'Ask opinion',
			programWeek: 1,
		})

		expect(queue.length).toBeGreaterThan(0)
		expect(queue.some((item) => getExerciseAction(item.exercise) === 'Ask opinion')).toBe(
			true
		)
		expect(queue.some((item) => item.focusPhase === 'repair')).toBe(false)
	})

	it('keeps news and politics drills out of the early weeks', async () => {
		await ensureExerciseStates(userId)
		const earlyQueue = await loadDailySprint(userId, 16, {
			targetLevel: 'B1',
			sentenceLength: 'long',
			sceneAction: 'Ask view',
			programWeek: 1,
		})
		expect(
			earlyQueue.every((item) => exerciseIsAvailableForWeek(item.exercise, 1))
		).toBe(true)
		expect(earlyQueue.some((item) => item.exercise.tags.includes('politics'))).toBe(
			false
		)
		expect(sourceContentUnlocked(16)).toBe(false)
		expect(sourceContentUnlocked(17)).toBe(true)
	})

	it('pulls open mistakes into the sprint as repair work', async () => {
		await ensureExerciseStates(userId)
		const mistake: MistakeItem = {
			id: `${userId}:cafe-produce-fast-1`,
			userId,
			exerciseId: 'cafe-produce-fast-1',
			sceneId: 'milan-cafe',
			promptEnglish: 'In my opinion, this place is welcoming.',
			userAnswer: 'posto bello',
			correctedItalian: 'Secondo me, questo posto e accogliente.',
			tags: ['opinion'],
			explanation: 'Start with "Secondo me".',
			repairPrompts: ['In my opinion, this place is welcoming.'],
			status: 'open',
			nextDueAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
			lastReviewedAt: null,
			attempts: 1,
		}
		await db.mistakes.put(mistake)

		const queue = await loadDailySprint(userId, 8, {
			targetLevel: 'B1',
			sentenceLength: 'long',
			sceneAction: 'Ask opinion',
			programWeek: 1,
		})

		expect(queue.some((item) => item.sourceMistakeId === mistake.id)).toBe(true)
	})

	it('uses saved AI-generated sentences as production prompts', async () => {
		await saveGeneratedExercises(
			userId,
			[
				{
					promptEnglish: 'I need to make a quick decision with my family.',
					targetItalian:
						'Devo prendere una decisione veloce con la mia famiglia.',
					acceptedItalian: [
						'Devo prendere una decisione veloce con la mia famiglia.',
					],
					hints: ['Use devo + infinitive.'],
					tags: ['generated', 'modal', 'family'],
					phraseFamily: 'Making plans',
					action: 'Ask opinion',
					keyVerb: 'dovere',
					construction: 'modal-infinitive',
				},
			],
			{
				targetLevel: 'B1',
				programWeek: 5,
				sentenceLength: 'medium',
				sceneId: 'family-table',
				action: 'Ask opinion',
				provider: 'openai',
				packId: 'test-pack',
			}
		)

		const queue = await loadDailySprint(userId, 4, {
			targetLevel: 'B1',
			sentenceLength: 'medium',
			sceneAction: 'Ask opinion',
			programWeek: 5,
		})

		expect(queue.some((item) => item.exercise.generated)).toBe(true)
		expect(
			queue.some((item) =>
				item.exercise.targetItalian.includes('decisione veloce')
			)
		).toBe(true)
	})
})

describe('mistake repair', () => {
	it('uses the 1/3/7 repair ladder before closing a mistake', async () => {
		const mistake: MistakeItem = {
			id: `${userId}:station-produce-solve-1`,
			userId,
			exerciseId: 'station-produce-solve-1',
			sceneId: 'station',
			promptEnglish: 'I do not understand which platform it is.',
			userAnswer: 'non capisco',
			correctedItalian: 'Non capisco qual e il binario.',
			tags: ['repair'],
			explanation: 'Use "Non capisco" to make the problem clear.',
			repairPrompts: ['I do not understand which platform it is.'],
			status: 'open',
			nextDueAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
			lastReviewedAt: null,
			attempts: 1,
			repairStep: 0,
		}
		await db.mistakes.put(mistake)

		const failed = await submitMistakeRepair({
			userId,
			mistake,
			answer: 'ciao',
			msUsed: 3000,
		})
		expect(failed.updated.status).toBe('reviewing')
		expect(failed.updated.repairStep).toBe(0)

		const firstRepair = await submitMistakeRepair({
			userId,
			mistake: failed.updated,
			answer: 'non capisco qual e il binario',
			msUsed: 7000,
		})
		expect(firstRepair.result.communicative).toBe(true)
		expect(firstRepair.updated.status).toBe('reviewing')
		expect(firstRepair.updated.repairStep).toBe(1)

		const secondRepair = await submitMistakeRepair({
			userId,
			mistake: firstRepair.updated,
			answer: 'non capisco qual e il binario',
			msUsed: 6000,
		})
		expect(secondRepair.updated.status).toBe('reviewing')
		expect(secondRepair.updated.repairStep).toBe(2)

		const finalRepair = await submitMistakeRepair({
			userId,
			mistake: secondRepair.updated,
			answer: 'non capisco qual e il binario',
			msUsed: 5000,
		})
		expect(finalRepair.updated.status).toBe('repaired')
		expect(finalRepair.updated.repairStep).toBe(3)
		expect(finalRepair.updated.nextDueAt).toBeNull()
	})
})

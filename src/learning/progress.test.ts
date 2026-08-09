import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExerciseAction } from '@/learning/content'
import { exerciseIsAvailableForWeek, sourceContentUnlocked } from '@/learning/curriculum'
import {
	generatedPromptIsCleanEnglish,
	saveGeneratedExercises,
} from '@/learning/generated-sentences'
import {
	ensureExerciseStates,
	loadDailySprint,
	submitMistakeRepair,
	withMinimumComplexity,
} from '@/learning/progress'
import { db, type MistakeItem } from '@/storage/db'

const userId = 'test-user'

beforeEach(async () => {
	await db.delete()
	await db.open()
})

afterEach(() => {
	vi.unstubAllGlobals()
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

	it('can compose the sprint without waiting for remote sentence generation', async () => {
		const fetchSpy = vi.fn()
		vi.stubGlobal('window', {})
		vi.stubGlobal('fetch', fetchSpy)

		const queue = await loadDailySprint(userId, 8, {
			targetLevel: 'B1',
			sentenceLength: 'medium',
			sceneAction: 'Ask opinion',
			programWeek: 1,
			generateFresh: false,
		})

		expect(queue.length).toBeGreaterThan(0)
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('starts with exact-level speech frames while AI material is loading', async () => {
		const queue = await loadDailySprint(userId, 8, {
			targetLevel: 'C1',
			sentenceLength: 'medium',
			programWeek: 1,
			generateFresh: false,
		})

		expect(queue.some((item) => item.exercise.cefrLevel === 'C1')).toBe(true)
		expect(queue.some((item) => item.levelBand === 'target')).toBe(true)
		expect(
			queue.some((item) => item.exercise.communicativeFunction === 'repair')
		).toBe(true)
	})

	it('models a frame at most once and raises challenge without showing the answer', async () => {
		const steady = await loadDailySprint(userId, 20, {
			targetLevel: 'A2',
			programWeek: 5,
			challengeMode: 'comfortable',
			generateFresh: false,
		})
		const modelCounts = new Map<string, number>()
		for (const item of steady.filter((entry) => entry.cueMode === 'model')) {
			const skillId = item.skillId ?? item.exercise.id
			modelCounts.set(skillId, (modelCounts.get(skillId) ?? 0) + 1)
		}
		expect([...modelCounts.values()].every((count) => count === 1)).toBe(true)

		const stretch = await loadDailySprint(userId, 20, {
			targetLevel: 'A2',
			programWeek: 5,
			challengeMode: 'stretch',
			generateFresh: false,
		})
		expect(stretch.every((item) => (item.complexityStep ?? 1) >= 2)).toBe(true)
		expect(stretch.every((item) => item.cueMode !== 'model')).toBe(true)

		const intensive = await loadDailySprint(userId, 20, {
			targetLevel: 'A2',
			programWeek: 5,
			challengeMode: 'intensive',
			generateFresh: false,
		})
		expect(intensive.every((item) => (item.complexityStep ?? 1) >= 4)).toBe(true)

		const model = steady.find((item) => item.cueMode === 'model')
		expect(model).toBeDefined()
		const bonus = withMinimumComplexity(model!, 3)
		expect(bonus.complexityStep).toBe(3)
		expect(bonus.cueMode).toBe('english')
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
					frameId: 'offer-family-modal-help',
					tenseFocus: 'modal-infinitive',
					vocabDomain: 'family',
					communicativeFunction: 'offer',
					maxWords: 10,
					utilityScore: 92,
					cefrLevel: 'B1',
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
		expect(queue.some((item) => item.exercise.frameId === 'offer-family-modal-help')).toBe(
			true
		)
	})

	it('rejects generated sentences that are long or low utility', async () => {
		const saved = await saveGeneratedExercises(
			userId,
			[
				{
					promptEnglish:
						'The purple armadillo eats a constant weight of insects in the mountains.',
					targetItalian:
						'Il armadillo viola mangia un peso costante di insetti quando vive in montagna.',
					acceptedItalian: [],
					hints: ['This should not be saved.'],
					tags: ['generated'],
					phraseFamily: 'Odd sentence',
					action: 'Build',
					keyVerb: 'mangiare',
					construction: 'surreal-long',
					maxWords: 8,
					utilityScore: 95,
				},
				{
					promptEnglish: 'Please pass me the bread.',
					targetItalian: 'Passami il pane, per favore.',
					acceptedItalian: [],
					hints: ['Useful, but the score says otherwise.'],
					tags: ['generated', 'food'],
					phraseFamily: 'Ask For Something At The Table',
					action: 'Build',
					keyVerb: 'passare',
					construction: 'imperative-request',
					frameId: 'request-food-imperative-pass-salt',
					tenseFocus: 'imperative',
					vocabDomain: 'food',
					communicativeFunction: 'request',
					maxWords: 6,
					utilityScore: 40,
				},
			],
			{
				targetLevel: 'B1',
				programWeek: 6,
				sentenceLength: 'medium',
				sceneId: 'family-table',
				action: 'Build',
				provider: 'openai',
				packId: 'bad-pack',
			}
		)

		expect(saved).toEqual([])
	})

	it('rejects generated prompts with Italian leaking into the English cue', async () => {
		expect(
			generatedPromptIsCleanEnglish(
				'I have to prendere un caffe before we leave. Use it in a simple questions conversation.'
			)
		).toBe(false)

		const saved = await saveGeneratedExercises(
			userId,
			[
				{
					promptEnglish:
						'I have to prendere un caffe before we leave. Use it in a simple questions conversation.',
					targetItalian: 'Devo prendere un caffe prima di partire.',
					acceptedItalian: ['Devo prendere un caffe prima di partire.'],
					hints: ['This should not be saved.'],
					tags: ['generated', 'modal'],
					phraseFamily: 'Making plans',
					action: 'Build',
					keyVerb: 'dovere',
					construction: 'dovere-infinitive',
					frameId: 'offer-family-modal-help',
					tenseFocus: 'modal-infinitive',
					vocabDomain: 'cafe',
					communicativeFunction: 'plan',
					maxWords: 8,
					utilityScore: 88,
				},
			],
			{
				targetLevel: 'B1',
				programWeek: 6,
				sentenceLength: 'medium',
				sceneId: 'milan-cafe',
				action: 'Build',
				provider: 'fallback',
				packId: 'mixed-language-pack',
			}
		)

		expect(saved).toEqual([])
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

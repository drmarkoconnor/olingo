import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Exercise } from '@/learning/content'
import { recordSkillAttempt } from '@/learning/skill-mastery'
import { deriveSkillId } from '@/learning/session-focus'
import { db } from '@/storage/db'

const userId = 'skill-user'

function variation(id: string, detail: string): Exercise {
	return {
		id,
		type: 'sentence',
		sceneId: 'family-table',
		promptEnglish: `Can I help with ${detail}?`,
		targetItalian: `Posso aiutare con ${detail}?`,
		acceptedItalian: [`Posso aiutare con ${detail}?`],
		hints: [],
		tags: ['modal', 'family', 'offer'],
		phraseFamily: 'Offer Practical Help',
		difficulty: 2,
		cefrLevel: 'A2',
		frameId: 'offer-family-modal-help',
		tenseFocus: 'modal-infinitive',
		vocabDomain: 'family',
		communicativeFunction: 'offer',
	}
}

beforeEach(async () => {
	await db.delete()
	await db.open()
})

describe('speaking skill mastery', () => {
	it('combines sentence variations into one skill and rewards spoken independence', async () => {
		const exercises = [
			variation('variation-1', 'dinner'),
			variation('variation-2', 'the shopping'),
			variation('variation-3', 'the children'),
			variation('variation-4', 'the table'),
		]

		await recordSkillAttempt({
			userId,
			exercise: exercises[0],
			targetLevel: 'A2',
			focus: 'modal-verbs',
			domain: 'family',
			complexityStep: 1,
			cueMode: 'model',
			communicative: true,
			accepted: true,
			hintsUsed: 1,
			wordBankUsed: false,
			spoken: true,
			responseLatencyMs: 4200,
		})

		for (let index = 1; index < exercises.length; index += 1) {
			await recordSkillAttempt({
				userId,
				exercise: exercises[index],
				targetLevel: 'A2',
				focus: 'modal-verbs',
				domain: 'family',
				complexityStep: Math.min(5, index + 2) as 3 | 4 | 5,
				cueMode: index === 1 ? 'english' : index === 2 ? 'situation' : 'interaction',
				communicative: true,
				accepted: true,
				hintsUsed: 0,
				wordBankUsed: false,
				spoken: true,
				responseLatencyMs: 3200 - index * 400,
			})
		}

		const states = await db.skillStates.where('userId').equals(userId).toArray()
		const attempts = await db.skillAttempts.where('userId').equals(userId).toArray()
		expect(states).toHaveLength(1)
		expect(states[0].skillId).toBe(deriveSkillId(exercises[0]))
		expect(states[0].attempts).toBe(3)
		expect(states[0].unassistedSuccesses).toBe(3)
		expect(states[0].fastSpokenSuccesses).toBe(3)
		expect(states[0].masteryStage).toBe(4)
		expect(attempts).toHaveLength(3)
	})

	it('does not treat a visible model as a retrieval or mastery attempt', async () => {
		const exercise = variation('model-only', 'dinner')
		const returned = await recordSkillAttempt({
			userId,
			exercise,
			targetLevel: 'A2',
			focus: 'modal-verbs',
			domain: 'family',
			complexityStep: 1,
			cueMode: 'model',
			communicative: true,
			accepted: true,
			hintsUsed: 0,
			wordBankUsed: false,
			spoken: true,
			responseLatencyMs: 2_000,
		})

		expect(returned.masteryStage).toBe(0)
		expect(await db.skillStates.count()).toBe(0)
		expect(await db.skillAttempts.count()).toBe(0)
	})

	it('does not label typed success as fast spoken mastery', async () => {
		const exercise = variation('typed-variation', 'dinner')
		for (let index = 0; index < 3; index += 1) {
			await recordSkillAttempt({
				userId,
				exercise,
				targetLevel: 'A2',
				focus: 'modal-verbs',
				domain: 'family',
				complexityStep: 4,
				cueMode: 'situation',
				communicative: true,
				accepted: true,
				hintsUsed: 0,
				wordBankUsed: false,
				spoken: false,
				responseLatencyMs: 2_000,
			})
		}

		const state = await db.skillStates.get([userId, deriveSkillId(exercise)])
		expect(state?.fastSpokenSuccesses).toBe(0)
		expect(state?.masteryStage).toBe(3)
	})
})

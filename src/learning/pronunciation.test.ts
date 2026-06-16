import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	getPronunciationPassage,
	pronunciationScoreLabel,
	recordPronunciationAttempt,
} from '@/learning/pronunciation'
import { db } from '@/storage/db'

const userId = 'pronunciation-user'

beforeEach(async () => {
	await db.delete()
	await db.open()
})

describe('pronunciation records', () => {
	it('labels low scores without fail language', () => {
		expect(pronunciationScoreLabel(35)).toBe('recorded')
		expect(pronunciationScoreLabel(55)).toBe('developing')
		expect(pronunciationScoreLabel(82)).toBe('clear')
	})

	it('stores read-aloud scores locally', async () => {
		const passage = getPronunciationPassage(1)
		await recordPronunciationAttempt({
			userId,
			dateKey: '2026-06-16',
			sessionId: `${userId}:2026-06-16`,
			passage,
			activeMs: 4200,
			feedback: {
				transcript: passage.text,
				intelligibilityScore: 94,
				passageCoverage: 96,
				rhythmScore: 90,
				problemSounds: [],
				missedWords: [],
				substitutions: [],
				shortFeedback: 'Excellent clarity.',
				practiceLines: [passage.text],
				provider: 'openai',
			},
		})

		const attempts = await db.pronunciationAttempts
			.where('userId')
			.equals(userId)
			.toArray()

		expect(attempts).toHaveLength(1)
		expect(attempts[0].score).toBe(94)
		expect(attempts[0].passageId).toBe(passage.id)
	})
})

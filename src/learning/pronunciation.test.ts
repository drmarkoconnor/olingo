import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	getPronunciationPassage,
	pronunciationScoreLabel,
	recordPronunciationAttempt,
	selectPronunciationPassage,
} from '@/learning/pronunciation'
import { db } from '@/storage/db'
import {
	deterministicFeedback,
	openAIKeyConfigError,
} from '../../netlify/functions/pronunciation-assessment'

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

	it('rotates passages within the same curriculum stage', () => {
		const passageIds = new Set(
			Array.from({ length: 7 }, (_value, index) =>
				getPronunciationPassage(1, `2026-06-${10 + index}`).id
			)
		)

		expect(passageIds.size).toBeGreaterThan(1)
	})

	it('avoids repeating a passage already recorded today when alternatives exist', async () => {
		const first = await selectPronunciationPassage(userId, 1, '2026-06-26')
		await recordPronunciationAttempt({
			userId,
			dateKey: '2026-06-26',
			sessionId: `${userId}:2026-06-26`,
			passage: first,
			activeMs: 3200,
			feedback: {
				transcript: first.text,
				intelligibilityScore: 88,
				passageCoverage: 90,
				rhythmScore: 85,
				problemSounds: [],
				missedWords: [],
				substitutions: [],
				shortFeedback: 'Clear reading.',
				practiceLines: [first.text],
				provider: 'openai',
			},
		})

		const second = await selectPronunciationPassage(userId, 1, '2026-06-26')

		expect(second.id).not.toBe(first.id)
	})

	it('does not inflate coverage when no transcript is available', () => {
		const passage = getPronunciationPassage(1)
		const feedback = deterministicFeedback(passage.text, '')

		expect(feedback.transcript).toBe('')
		expect(feedback.intelligibilityScore).toBe(0)
		expect(feedback.passageCoverage).toBe(0)
		expect(feedback.rhythmScore).toBe(0)
		expect(feedback.shortFeedback).toContain('could not detect')
	})

	it('detects a Netlify value set to a full OPENAI_API_KEY line', () => {
		expect(openAIKeyConfigError('OPENAI_API_KEY=sk-test')).toContain(
			'actual key value only'
		)
		expect(openAIKeyConfigError('not-a-key')).toContain('starting with sk-')
		expect(openAIKeyConfigError('sk-test')).toBeNull()
	})
})

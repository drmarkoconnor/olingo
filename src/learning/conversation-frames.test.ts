import { describe, expect, it } from 'vitest'
import {
	conversationFrames,
	countItalianWords,
	getActiveTenseFocusesForWeek,
	getConversationFramesForWeek,
	recognitionOnlyTenses,
} from '@/learning/conversation-frames'

describe('conversation frame matrix', () => {
	it('spirals active spoken tenses through the 24-week plan', () => {
		expect(getActiveTenseFocusesForWeek(1)).toEqual(['present'])
		expect(getActiveTenseFocusesForWeek(6)).toEqual([
			'present',
			'modal-infinitive',
			'imperative',
		])
		expect(getActiveTenseFocusesForWeek(10)).toContain('passato-prossimo')
		expect(getActiveTenseFocusesForWeek(18)).toEqual([
			'present',
			'passato-prossimo',
			'future',
			'conditional',
		])
		expect(getActiveTenseFocusesForWeek(23)).toContain('subjunctive-chunk')
		expect(recognitionOnlyTenses).toContain('trapassato')
	})

	it('keeps frame seeds short, practical, and high-utility', () => {
		expect(conversationFrames.length).toBeGreaterThanOrEqual(20)
		for (const frame of conversationFrames) {
			expect(countItalianWords(frame.seedItalian)).toBeLessThanOrEqual(
				frame.maxWords
			)
			expect(frame.maxWords).toBeLessThanOrEqual(12)
			expect(frame.utilityScore).toBeGreaterThanOrEqual(80)
			expect(frame.seedEnglish.toLowerCase()).not.toContain('armadillo')
		}
	})

	it('selects action-relevant frames without leaving the spoken tense band', () => {
		const frames = getConversationFramesForWeek(6, {
			targetLevel: 'B1',
			action: 'Offer help',
			limit: 6,
		})
		expect(frames.length).toBeGreaterThan(0)
		expect(frames[0].communicativeFunction).toBe('offer')
		expect(
			frames.every((frame) =>
				['present', 'modal-infinitive', 'imperative'].includes(frame.tenseFocus)
			)
		).toBe(true)
	})
})

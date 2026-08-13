import { describe, expect, it } from 'vitest'
import {
	conversationFrames,
	countItalianWords,
	getActiveTenseFocusesForWeek,
	getConversationFramesForWeek,
	getGenerationFramesForWeek,
	getSessionGenerationFrames,
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
		expect(frames.every((frame) => frame.communicativeFunction === 'offer')).toBe(
			true
		)
		expect(
			frames.every((frame) =>
				['present', 'modal-infinitive', 'imperative'].includes(frame.tenseFocus)
			)
		).toBe(true)
	})

	it('prefers frames introduced at the selected advanced level', () => {
		const b2 = getGenerationFramesForWeek(18, {
			targetLevel: 'B2',
			limit: 6,
		})
		const c1 = getGenerationFramesForWeek(18, {
			targetLevel: 'C1',
			limit: 6,
		})

		expect(b2[0].cefrLevel).toBe('B2')
		expect(c1[0].cefrLevel).toBe('C1')
		expect(c1.some((frame) => frame.tags.includes('reformulation'))).toBe(true)
	})

	it('provides five stable level and domain frames for a chosen activity', () => {
		const frames = getSessionGenerationFrames(17, {
			targetLevel: 'A2',
			domains: ['family'],
			tenseFocuses: ['future'],
			communicativeFunctions: ['plan', 'offer'],
			sessionFocus: 'future-plans',
			focusLabel: 'Future plans',
			limit: 5,
		})

		expect(frames).toHaveLength(5)
		expect(new Set(frames.map((frame) => frame.id)).size).toBe(5)
		expect(
			frames.every(
				(frame) =>
					frame.cefrLevel === 'A2' &&
					frame.vocabDomain === 'family' &&
					frame.tenseFocus === 'future'
			)
		).toBe(true)
	})
})

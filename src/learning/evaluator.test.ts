import { describe, expect, it } from 'vitest'
import { exercises } from '@/learning/content'
import { evaluateAnswer } from '@/learning/evaluator'

const opinion = exercises.find((exercise) => exercise.id === 'cafe-produce-fast-1')!

describe('evaluateAnswer', () => {
	it('accepts a perfect fast answer as fluent', () => {
		const result = evaluateAnswer(
			opinion,
			'Secondo me questo posto e accogliente',
			0,
			6000
		)
		expect(result.accepted).toBe(true)
		expect(result.exerciseValid).toBe(true)
		expect(result.communicative).toBe(true)
		expect(result.outcome).toBe('easy')
	})

	it('rewards a rough but communicative answer without calling it perfect', () => {
		const result = evaluateAnswer(opinion, 'secondo me posto accogliente', 0, 9000)
		expect(result.accepted).toBe(false)
		expect(result.communicative).toBe(true)
		expect(result.outcome).toBe('hard')
		expect(result.shortFeedback).toContain('idea')
	})

	it('keeps a missing core idea in repair practice', () => {
		const result = evaluateAnswer(opinion, 'non capisco il binario', 0, 9000)
		expect(result.accepted).toBe(false)
		expect(result.communicative).toBe(false)
		expect(result.outcome).toBe('again')
		expect(result.repairPrompts.length).toBeGreaterThan(0)
	})
})

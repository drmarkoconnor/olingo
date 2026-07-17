import { describe, expect, it } from 'vitest'
import {
	fallbackExercises,
	sanitizeSourceExercises,
} from '../../netlify/functions/generate-content-pack'

function words(value: string) {
	return value.replace(/[.,!?;:()]/g, ' ').split(/\s+/).filter(Boolean).length
}

describe('source transfer generation', () => {
	it('provides three short fallback drills at every selected level', () => {
		for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
			const exercises = fallbackExercises(level)
			expect(exercises).toHaveLength(3)
			expect(exercises.every((exercise) => words(exercise.targetItalian) <= 12)).toBe(
				true
			)
		}
	})

	it('rejects a source sentence outside the chosen level word range', () => {
		const exercises = sanitizeSourceExercises(
			[
				{
					promptEnglish: 'This is useful.',
					targetItalian: 'Questo è utile.',
					phase: 'produce',
					action: 'React',
				},
				{
					promptEnglish: 'This sentence is deliberately much too long.',
					targetItalian:
						'Questa frase è decisamente troppo lunga per essere una risposta rapida e utile.',
					phase: 'speak',
					action: 'React',
				},
			],
			'A1'
		)

		expect(exercises.map((exercise) => exercise.targetItalian)).toEqual([
			'Questo è utile.',
		])
	})
})

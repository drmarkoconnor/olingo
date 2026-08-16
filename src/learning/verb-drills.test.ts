import { describe, expect, it } from 'vitest'
import { cefrLevels } from '@/learning/content'
import {
	drillFamilies,
	drillFocusAvailable,
	drillFocuses,
	getDrillStagePlan,
} from '@/learning/drill-catalogue'
import {
	buildGeneratedDrillRun,
	buildLocalDrillRun,
	drillRunIsValid,
} from '@/learning/verb-drills'

const stageOrder = [
	'meet',
	'retrieve',
	'switch',
	'polarity',
	'pronoun',
	'time',
	'conversation',
]

describe('progressive verb-family drills', () => {
	it('builds a complete, unique, ordered ladder for every available choice', () => {
		for (const family of drillFamilies) {
			for (const level of cefrLevels) {
				for (const focus of drillFocuses) {
					if (!drillFocusAvailable(family, focus.id, level)) continue
					for (const targetCount of [20, 30]) {
						const run = buildLocalDrillRun({
							familyId: family.id,
							focus: focus.id,
							level,
							targetCount,
							seed: 20260816,
						})
						expect(run.prompts).toHaveLength(targetCount)
						expect(drillRunIsValid(run)).toBe(true)
						const indexes = run.prompts.map((prompt) =>
							stageOrder.indexOf(prompt.stage)
						)
						expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
					}
				}
			}
		}
	})

	it('keeps A1 guided practice to one-step present operations', () => {
		const plan = getDrillStagePlan('A1', 'guided', 20)
		expect(plan).not.toContain('pronoun')
		expect(plan).not.toContain('time')
		expect(plan[0]).toBe('meet')
		expect(plan.at(-1)).toBe('conversation')
	})

	it('gives pronoun practice a clear noun foundation before compression', () => {
		const run = buildLocalDrillRun({
			familyId: 'giving',
			focus: 'pronouns',
			level: 'B1',
			targetCount: 20,
			seed: 71,
		})
		const firstPronoun = run.prompts.findIndex((prompt) => prompt.stage === 'pronoun')
		const foundation = run.prompts.slice(0, firstPronoun)
		expect(firstPronoun).toBeGreaterThan(2)
		expect(
			foundation.some((prompt) =>
				/\b(?:book|keys|salt|coffee|photo|bread)\b/i.test(
					prompt.exercise.promptEnglish
				)
			)
		).toBe(true)
		expect(
			run.prompts.filter((prompt) => prompt.stage === 'pronoun').length
		).toBeGreaterThanOrEqual(8)
	})

	it('uses exact English meanings and properly written Italian in the curated bank', () => {
		const brokenItalian =
			/\b(?:Perche|Puo|caffe|verita|piu|gia|Tornero|Dovro)\b|\b(?:l|dell|gliel)\s+(?:ho|acqua|orario|autobus|appuntamento|avevo)\b/
		for (const family of drillFamilies) {
			const run = buildLocalDrillRun({
				familyId: family.id,
				focus: 'guided',
				level: 'B1',
				targetCount: 30,
				seed: 11,
			})
			for (const prompt of run.prompts) {
				expect(prompt.exercise.promptEnglish.trim()).not.toBe('')
				expect(prompt.exercise.targetItalian).not.toMatch(brokenItalian)
				expect(prompt.exercise.utilityScore).toBeGreaterThanOrEqual(80)
				expect(prompt.exercise.maxWords).toBeLessThanOrEqual(12)
			}
		}
	})

	it('fills a partially generated ladder with vetted local prompts', () => {
		const run = buildGeneratedDrillRun({
			familyId: 'modal-engine',
			focus: 'guided',
			level: 'A2',
			targetCount: 20,
			packId: 'test-pack',
			prompts: [
				{
					stage: 'meet',
					promptEnglish: 'I want to stay here.',
					targetItalian: 'Voglio restare qui.',
					keyVerb: 'volere',
					tenseFocus: 'modal-infinitive',
					vocabDomain: 'family',
					communicativeFunction: 'plan',
					maxWords: 5,
					utilityScore: 96,
				},
			],
		})
		expect(run.prompts).toHaveLength(20)
		expect(run.prompts[0].exercise.targetItalian).toBe('Voglio restare qui.')
		expect(drillRunIsValid(run)).toBe(true)
	})
})

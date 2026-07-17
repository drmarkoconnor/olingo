import type { CefrLevel, ExerciseDifficulty } from '@/learning/content'

export type LevelBand = 'consolidation' | 'target' | 'stretch'

export const cefrOrder: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

const profileGuidance: Record<CefrLevel, string> = {
	A1: 'Direct everyday needs, present tense, simple questions, and memorisable chunks.',
	A2: 'Routine exchanges, modal verbs, simple past events, requests, and time phrases.',
	B1: 'Connected everyday speech with reasons, narration, plans, and practical pronouns.',
	B2: 'Natural qualification, comparison, consequence, hypothetical planning, and repair.',
	C1: 'Precise stance, reformulation, tactful disagreement, and flexible adult register.',
}

const profileWordRanges: Record<CefrLevel, [number, number]> = {
	A1: [3, 7],
	A2: [4, 9],
	B1: [5, 10],
	B2: [5, 11],
	C1: [5, 12],
}

export function cefrRank(level: CefrLevel) {
	return cefrOrder.indexOf(level)
}

export function levelForDifficulty(difficulty: ExerciseDifficulty): CefrLevel {
	return cefrOrder[Math.max(0, Math.min(4, difficulty - 1))]
}

export function difficultyForCefr(level: CefrLevel): ExerciseDifficulty {
	return (cefrRank(level) + 1) as ExerciseDifficulty
}

export function adjacentLevel(level: CefrLevel, offset: -1 | 1) {
	return cefrOrder[Math.max(0, Math.min(cefrOrder.length - 1, cefrRank(level) + offset))]
}

export function levelBand(itemLevel: CefrLevel, targetLevel: CefrLevel): LevelBand {
	const difference = cefrRank(itemLevel) - cefrRank(targetLevel)
	if (difference === 0) return 'target'
	return difference < 0 ? 'consolidation' : 'stretch'
}

export function getLearningProfile(targetLevel: CefrLevel) {
	const [minWords, maxWords] = profileWordRanges[targetLevel]
	return {
		targetLevel,
		consolidationLevel: adjacentLevel(targetLevel, -1),
		stretchLevel: adjacentLevel(targetLevel, 1),
		guidance: profileGuidance[targetLevel],
		minWords,
		maxWords,
	}
}

export function getLevelQuotas(targetLevel: CefrLevel, limit: number) {
	const safeLimit = Math.max(1, Math.round(limit))
	if (targetLevel === 'A1') {
		const target = Math.max(1, Math.round(safeLimit * 0.85))
		return { target, consolidation: 0, stretch: safeLimit - target }
	}
	if (targetLevel === 'C1') {
		const target = Math.max(1, Math.round(safeLimit * 0.75))
		return { target, consolidation: safeLimit - target, stretch: 0 }
	}
	const target = Math.max(1, Math.round(safeLimit * 0.7))
	const consolidation = Math.max(1, Math.round(safeLimit * 0.2))
	return {
		target,
		consolidation,
		stretch: Math.max(0, safeLimit - target - consolidation),
	}
}

export function selectLevelBalanced<T>(
	items: T[],
	itemLevel: (item: T) => CefrLevel,
	targetLevel: CefrLevel,
	limit: number
) {
	const quotas = getLevelQuotas(targetLevel, limit)
	const buckets: Record<LevelBand, T[]> = {
		target: [],
		consolidation: [],
		stretch: [],
	}
	for (const item of items) buckets[levelBand(itemLevel(item), targetLevel)].push(item)
	for (const band of ['consolidation', 'stretch'] as const) {
		buckets[band].sort(
			(a, b) =>
				Math.abs(cefrRank(itemLevel(a)) - cefrRank(targetLevel)) -
				Math.abs(cefrRank(itemLevel(b)) - cefrRank(targetLevel))
		)
	}

	const selected: T[] = []
	const take = (band: LevelBand, count: number) => {
		selected.push(...buckets[band].splice(0, count))
	}
	take('target', quotas.target)
	take('consolidation', quotas.consolidation)
	take('stretch', quotas.stretch)

	for (const band of ['target', 'consolidation', 'stretch'] as const) {
		if (selected.length >= limit) break
		take(band, limit - selected.length)
	}
	return selected.slice(0, limit)
}

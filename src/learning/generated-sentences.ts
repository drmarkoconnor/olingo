import {
	cefrLevels,
	exercises,
	type CefrLevel,
	type Exercise,
	type ExerciseDifficulty,
} from '@/learning/content'
import {
	exerciseIsAvailableForWeek,
	getCurriculumStage,
	getExerciseConstruction,
	getExerciseRoundFocus,
} from '@/learning/curriculum'
import { createExerciseState } from '@/learning/scheduler'
import { db, type GeneratedExerciseItem, type MistakeItem } from '@/storage/db'

export type SentenceLength = 'short' | 'medium' | 'long'

export type GeneratedSentenceOptions = {
	targetLevel?: CefrLevel
	sentenceLength?: SentenceLength
	programWeek: number
	sceneId?: string
	sceneTitle?: string
	action?: string
	targetCount?: number
	minFresh?: number
}

type GeneratedExercisePayload = {
	promptEnglish: string
	targetItalian: string
	acceptedItalian?: string[]
	hints?: string[]
	tags?: string[]
	phraseFamily?: string
	phase?: 'warmup' | 'produce' | 'repair' | 'speak'
	action?: string
	communicativeGoal?: string
	spokenCue?: string
	repairPrompts?: string[]
	keyVerb?: string
	construction?: string
	npcLine?: string
}

type GeneratedPackResponse = {
	exercises?: GeneratedExercisePayload[]
	provider?: 'openai' | 'fallback'
	packId?: string
}

const packSize = 16
const freshPoolTarget = 24

export function isCefrLevel(value: unknown): value is CefrLevel {
	return typeof value === 'string' && cefrLevels.includes(value as CefrLevel)
}

export function normaliseTargetLevel(value: unknown): CefrLevel {
	return isCefrLevel(value) ? value : 'B1'
}

export function difficultyForLevel(level?: CefrLevel): ExerciseDifficulty {
	if (level === 'A1') return 1
	if (level === 'A2') return 2
	if (level === 'B2') return 4
	if (level === 'C1') return 5
	return 3
}

export function levelForDifficulty(difficulty: ExerciseDifficulty): CefrLevel {
	if (difficulty <= 1) return 'A1'
	if (difficulty === 2) return 'A2'
	if (difficulty === 4) return 'B2'
	if (difficulty >= 5) return 'C1'
	return 'B1'
}

export function sentenceFitsLength(
	exercise: Pick<Exercise, 'targetItalian'>,
	length?: SentenceLength
) {
	if (!length || length === 'long') return true
	const words = exercise.targetItalian.split(/\s+/).filter(Boolean).length
	if (length === 'short') return words <= 7
	return words <= 11
}

function simpleHash(value: string) {
	let hash = 5381
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 33) ^ value.charCodeAt(index)
	}
	return (hash >>> 0).toString(36)
}

function normaliseSentence(value: string) {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFC')
		.replace(/[’']/g, ' ')
		.replace(/[.,!?;:()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

export function sentenceContentHash(promptEnglish: string, targetItalian: string) {
	return simpleHash(
		`${normaliseSentence(promptEnglish)}::${normaliseSentence(targetItalian)}`
	)
}

function unique(values: string[]) {
	return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function clampText(value: unknown, fallback: string) {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function defaultPhase(level: CefrLevel) {
	return level === 'A1' || level === 'A2' ? 'produce' : 'speak'
}

export function generatedItemToExercise(item: GeneratedExerciseItem): Exercise {
	return {
		id: item.id,
		type: item.type,
		sceneId: item.sceneId,
		promptEnglish: item.promptEnglish,
		targetItalian: item.targetItalian,
		acceptedItalian: item.acceptedItalian,
		hints: item.hints,
		tags: item.tags,
		phraseFamily: item.phraseFamily,
		difficulty: item.difficulty,
		cefrLevel: item.cefrLevel,
		generated: true,
		phase: item.phase,
		action: item.action,
		communicativeGoal: item.communicativeGoal,
		spokenCue: item.spokenCue,
		repairPrompts: item.repairPrompts,
		sourceId: item.sourceId,
		curriculumWeeks: item.curriculumWeeks,
		strand: item.strand,
		roundFocus: item.roundFocus,
		keyVerb: item.keyVerb,
		construction: item.construction,
		npcLine: item.npcLine,
	}
}

export async function loadGeneratedExercises(userId: string) {
	const items = await db.generatedExercises
		.where('userId')
		.equals(userId)
		.and((exercise) => exercise.retired !== 1)
		.toArray()
	return items.sort(
		(a, b) =>
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	)
}

export async function loadSeenProductionExerciseIds(userId: string) {
	const logs = await db.exerciseLogs.where('userId').equals(userId).toArray()
	return new Set(
		logs
			.filter((log) => log.mode !== 'repair')
			.map((log) => log.exerciseId)
	)
}

function exerciseMatchesOptions(
	exercise: Exercise,
	options: GeneratedSentenceOptions
) {
	const targetLevel = normaliseTargetLevel(options.targetLevel)
	return (
		exercise.difficulty <= difficultyForLevel(targetLevel) &&
		exerciseIsAvailableForWeek(exercise, options.programWeek) &&
		sentenceFitsLength(exercise, options.sentenceLength)
	)
}

export function exerciseIsGenerated(exercise: Exercise) {
	return exercise.generated || exercise.sourceId?.startsWith('ai-generated')
}

export async function saveGeneratedExercises(
	userId: string,
	payloads: GeneratedExercisePayload[],
	options: GeneratedSentenceOptions & { provider?: 'openai' | 'fallback'; packId?: string }
) {
	const targetLevel = normaliseTargetLevel(options.targetLevel)
	const difficulty = difficultyForLevel(targetLevel)
	const now = new Date().toISOString()
	const stage = getCurriculumStage(options.programWeek)
	const existing = await db.generatedExercises
		.where('userId')
		.equals(userId)
		.toArray()
	const existingHashes = new Set(existing.map((item) => item.contentHash))
	const existingItalian = new Set(
		[
			...exercises.map((exercise) => exercise.targetItalian),
			...existing.map((item) => item.targetItalian),
		].map(normaliseSentence)
	)
	const existingEnglish = new Set(
		[
			...exercises.map((exercise) => exercise.promptEnglish),
			...existing.map((item) => item.promptEnglish),
		].map(normaliseSentence)
	)
	const items: GeneratedExerciseItem[] = []

	for (const payload of payloads) {
		const promptEnglish = clampText(payload.promptEnglish, '')
		const targetItalian = clampText(payload.targetItalian, '')
		if (!promptEnglish || !targetItalian) continue
		const contentHash = sentenceContentHash(promptEnglish, targetItalian)
		if (existingHashes.has(contentHash)) continue
		const italianKey = normaliseSentence(targetItalian)
		const englishKey = normaliseSentence(promptEnglish)
		if (existingItalian.has(italianKey) || existingEnglish.has(englishKey)) continue
		existingHashes.add(contentHash)
		existingItalian.add(italianKey)
		existingEnglish.add(englishKey)
		const phraseFamily = clampText(
			payload.phraseFamily,
			stage.phraseFamilies[0] ?? 'Generated sentence production'
		)
		const construction = clampText(
			payload.construction,
			`${phraseFamily}:${payload.keyVerb ?? stage.tags[0] ?? targetLevel}`
		)
		const id = `${userId}:ai:${contentHash}`
		const tags = unique([
			targetLevel.toLowerCase(),
			'generated',
			...(payload.tags ?? stage.tags),
		]).slice(0, 8)

		items.push({
			id,
			userId,
			source: options.provider === 'fallback' ? 'fallback' : 'ai',
			contentHash,
			type: 'sentence',
			sceneId: options.sceneId ?? 'family-table',
			promptEnglish,
			targetItalian,
			acceptedItalian: unique([
				targetItalian,
				...(payload.acceptedItalian ?? []),
			]).slice(0, 4),
			hints: unique(payload.hints ?? [`Focus on ${construction}.`]).slice(0, 3),
			tags,
			phraseFamily,
			difficulty,
			cefrLevel: targetLevel,
			generated: true,
			phase: payload.phase ?? defaultPhase(targetLevel),
			action: payload.action ?? options.action ?? 'Build',
			communicativeGoal: payload.communicativeGoal,
			spokenCue:
				payload.spokenCue ??
				'Say a rough version quickly before typing. Good enough comes first.',
			repairPrompts: unique(payload.repairPrompts ?? [promptEnglish]).slice(0, 3),
			sourceId: `ai-generated:${options.packId ?? now}`,
			curriculumWeeks: stage.weeks,
			strand: 'output',
			roundFocus: getExerciseRoundFocus({
				id,
				type: 'sentence',
				sceneId: options.sceneId ?? 'family-table',
				promptEnglish,
				targetItalian,
				acceptedItalian: [targetItalian],
				hints: payload.hints ?? [],
				tags,
				phraseFamily,
				difficulty,
				cefrLevel: targetLevel,
				construction,
			}),
			keyVerb: payload.keyVerb,
			construction,
			npcLine: payload.npcLine,
			createdAt: now,
			lastUsedAt: null,
			useCount: 0,
			retired: 0,
		})
	}

	if (!items.length) return []

	await db.transaction('rw', db.generatedExercises, db.exerciseStates, async () => {
		await db.generatedExercises.bulkPut(items)
		const states = await db.exerciseStates.where('userId').equals(userId).toArray()
		const stateIds = new Set(states.map((state) => state.exerciseId))
		const newStates = items
			.filter((item) => !stateIds.has(item.id))
			.map((item) => createExerciseState(userId, item.id))
		if (newStates.length) await db.exerciseStates.bulkPut(newStates)
	})

	return items
}

function recentMistakeTags(mistakes: MistakeItem[]) {
	const tags = mistakes.flatMap((mistake) => mistake.tags)
	return unique(tags).slice(0, 8)
}

export async function ensureGeneratedSentencePool(
	userId: string,
	options: GeneratedSentenceOptions
) {
	const targetLevel = normaliseTargetLevel(options.targetLevel)
	const minFresh = options.minFresh ?? freshPoolTarget
	const generated = await loadGeneratedExercises(userId)
	const seenIds = await loadSeenProductionExerciseIds(userId)
	const freshEligible = generated.filter(
		(item) =>
			item.cefrLevel === targetLevel &&
			exerciseMatchesOptions(generatedItemToExercise(item), options) &&
			!seenIds.has(item.id)
	)

	if (freshEligible.length >= minFresh || typeof window === 'undefined') {
		return generated
	}

	const stage = getCurriculumStage(options.programWeek)
	const mistakes = await db.mistakes.where('userId').equals(userId).toArray()
	const avoidItalian = unique([
		...exercises.map((exercise) => exercise.targetItalian),
		...generated.map((exercise) => exercise.targetItalian),
	]).slice(-180)
	const avoidEnglish = unique([
		...exercises.map((exercise) => exercise.promptEnglish),
		...generated.map((exercise) => exercise.promptEnglish),
	]).slice(-180)

	try {
		const response = await fetch('/api/generate-sentence-pack', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				level: targetLevel,
				programWeek: options.programWeek,
				stage,
				sceneId: options.sceneId,
				sceneTitle: options.sceneTitle,
				action: options.action,
				sentenceLength: options.sentenceLength ?? 'medium',
				targetCount: options.targetCount ?? packSize,
				weakTags: recentMistakeTags(mistakes),
				avoidItalian,
				avoidEnglish,
			}),
		})
		if (!response.ok) return generated
		const pack = (await response.json()) as GeneratedPackResponse
		const saved = await saveGeneratedExercises(userId, pack.exercises ?? [], {
			...options,
			targetLevel,
			provider: pack.provider ?? 'openai',
			packId: pack.packId,
		})
		if (!saved.length) return generated
		return loadGeneratedExercises(userId)
	} catch {
		return generated
	}
}

export async function recordGeneratedExerciseUse(userId: string, exerciseId: string) {
	const item = await db.generatedExercises.get(exerciseId)
	if (!item || item.userId !== userId) return
	await db.generatedExercises.put({
		...item,
		useCount: item.useCount + 1,
		lastUsedAt: new Date().toISOString(),
	})
}

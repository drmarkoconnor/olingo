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
	getExerciseRoundFocus,
} from '@/learning/curriculum'
import {
	countItalianWords,
	getActiveTenseFocusesForWeek,
	getConversationFramesForWeek,
	getFrameById,
	getGenerationFramesForWeek,
	recognitionOnlyTenses,
	type CommunicativeFunction,
	type TenseFocus,
	type VocabDomain,
} from '@/learning/conversation-frames'
import { createExerciseState } from '@/learning/scheduler'
import {
	difficultyForCefr,
	levelForDifficulty as cefrForDifficulty,
} from '@/learning/learning-profile'
import { apiFetch } from '@/lib/api'
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
	frameId?: string
	tenseFocus?: TenseFocus
	vocabDomain?: VocabDomain
	communicativeFunction?: CommunicativeFunction
	maxWords?: number
	utilityScore?: number
	cefrLevel?: CefrLevel
}

type GeneratedPackResponse = {
	exercises?: GeneratedExercisePayload[]
	provider?: 'openai' | 'fallback'
	packId?: string
	level?: CefrLevel
	programWeek?: number
	sceneId?: string
	sceneTitle?: string
	action?: string
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
	return difficultyForCefr(level ?? 'B1')
}

export function levelForDifficulty(difficulty: ExerciseDifficulty): CefrLevel {
	return cefrForDifficulty(difficulty)
}

export function sentenceFitsLength(
	exercise: Pick<Exercise, 'targetItalian' | 'maxWords'>,
	length?: SentenceLength
) {
	if (exercise.maxWords && countItalianWords(exercise.targetItalian) > exercise.maxWords) {
		return false
	}
	if (!length || length === 'long') return true
	const words = countItalianWords(exercise.targetItalian)
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

const leakedGeneratorInstruction = /\buse it in a\b.+\bconversation\b/i
const italianLeakInEnglish = /\b(prendere|partire|preparare|guardare|ascoltare|ordinare|pagato|pagare|caffe|caffè|perche|piu|binario|uscire|venire|andare|fare una|fare la|dirmi|parlarne)\b/i

export function generatedPromptIsCleanEnglish(promptEnglish: string) {
	const prompt = promptEnglish.trim()
	if (!prompt) return false
	if (leakedGeneratorInstruction.test(prompt)) return false
	if (italianLeakInEnglish.test(prompt)) return false
	return true
}

function tokenSimilarity(a: string, b: string) {
	const aTokens = new Set(a.split(' ').filter(Boolean))
	const bTokens = new Set(b.split(' ').filter(Boolean))
	if (!aTokens.size || !bTokens.size) return 0
	let overlap = 0
	for (const token of aTokens) {
		if (bTokens.has(token)) overlap += 1
	}
	return overlap / Math.max(aTokens.size, bTokens.size)
}

function hasNearDuplicate(value: string, existing: string[]) {
	return existing.some((item) => tokenSimilarity(value, item) >= 0.9)
}

function filterNearDuplicateGeneratedItems(items: GeneratedExerciseItem[]) {
	const seenItalian: string[] = []
	const seenEnglish: string[] = []
	return items.filter((item) => {
		if (!generatedPromptIsCleanEnglish(item.promptEnglish)) return false
		const italian = normaliseSentence(item.targetItalian)
		const english = normaliseSentence(item.promptEnglish)
		if (
			hasNearDuplicate(italian, seenItalian) ||
			hasNearDuplicate(english, seenEnglish)
		) {
			return false
		}
		seenItalian.push(italian)
		seenEnglish.push(english)
		return true
	})
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

function defaultMaxWordsFor(level: CefrLevel, length?: SentenceLength) {
	if (length === 'short') return 7
	if (length === 'long' && (level === 'B1' || level === 'B2' || level === 'C1')) {
		return 12
	}
	return 10
}

function clampMaxWords(value: unknown, fallback: number) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return fallback
	return Math.max(4, Math.min(12, Math.round(parsed)))
}

function clampUtilityScore(value: unknown, fallback: number) {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return fallback
	return Math.max(0, Math.min(100, Math.round(parsed)))
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
		frameId: item.frameId,
		tenseFocus: item.tenseFocus,
		vocabDomain: item.vocabDomain,
		communicativeFunction: item.communicativeFunction,
		maxWords: item.maxWords,
		utilityScore: item.utilityScore,
	}
}

export async function loadGeneratedExercises(userId: string) {
	const items = await db.generatedExercises
		.where('userId')
		.equals(userId)
		.and((exercise) => exercise.retired !== 1)
		.toArray()
	const sorted = items.sort(
		(a, b) =>
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	)
	return filterNearDuplicateGeneratedItems(sorted)
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
	const now = new Date().toISOString()
	const stage = getCurriculumStage(options.programWeek)
	const frames = getConversationFramesForWeek(options.programWeek, {
		targetLevel,
		action: options.action,
		limit: 18,
	})
	const fallbackMaxWords = defaultMaxWordsFor(targetLevel, options.sentenceLength)
	const existing = await db.generatedExercises
		.where('userId')
		.equals(userId)
		.toArray()
	const existingHashes = new Set(existing.map((item) => item.contentHash))
	const existingItalianList = [
		...exercises.map((exercise) => exercise.targetItalian),
		...existing.map((item) => item.targetItalian),
	].map(normaliseSentence)
	const existingEnglishList = [
		...exercises.map((exercise) => exercise.promptEnglish),
		...existing.map((item) => item.promptEnglish),
	].map(normaliseSentence)
	const existingItalian = new Set(existingItalianList)
	const existingEnglish = new Set(existingEnglishList)
	const items: GeneratedExerciseItem[] = []

	for (const payload of payloads) {
		const promptEnglish = clampText(payload.promptEnglish, '')
		const targetItalian = clampText(payload.targetItalian, '')
		if (!promptEnglish || !targetItalian) continue
		if (!generatedPromptIsCleanEnglish(promptEnglish)) continue
		const contentHash = sentenceContentHash(promptEnglish, targetItalian)
		if (existingHashes.has(contentHash)) continue
		const italianKey = normaliseSentence(targetItalian)
		const englishKey = normaliseSentence(promptEnglish)
		const providedFrame = getFrameById(payload.frameId)
		const fallbackFrame = frames[items.length % Math.max(1, frames.length)]
		const frame = providedFrame ?? fallbackFrame
		const itemLevel = isCefrLevel(payload.cefrLevel)
			? payload.cefrLevel
			: frame?.cefrLevels[0] ?? targetLevel
		const difficulty = difficultyForLevel(itemLevel)
		const maxWords = clampMaxWords(
			payload.maxWords,
			providedFrame?.maxWords ?? fallbackMaxWords
		)
		const utilityScore = clampUtilityScore(
			payload.utilityScore,
			frame?.utilityScore ?? 80
		)
		if (utilityScore < 70) continue
		if (countItalianWords(targetItalian) > maxWords) continue
		if (existingItalian.has(italianKey) || existingEnglish.has(englishKey)) continue
		if (
			hasNearDuplicate(italianKey, existingItalianList) ||
			hasNearDuplicate(englishKey, existingEnglishList)
		) {
			continue
		}
		existingHashes.add(contentHash)
		existingItalian.add(italianKey)
		existingEnglish.add(englishKey)
		existingItalianList.push(italianKey)
		existingEnglishList.push(englishKey)
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
			itemLevel.toLowerCase(),
			'generated',
			payload.communicativeFunction ?? frame?.communicativeFunction ?? '',
			payload.tenseFocus ?? frame?.tenseFocus ?? '',
			payload.vocabDomain ?? frame?.vocabDomain ?? '',
			...(payload.tags ?? stage.tags),
		]).slice(0, 8)
		const frameId = payload.frameId ?? frame?.id
		const tenseFocus = payload.tenseFocus ?? frame?.tenseFocus
		const vocabDomain = payload.vocabDomain ?? frame?.vocabDomain
		const communicativeFunction =
			payload.communicativeFunction ?? frame?.communicativeFunction

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
			cefrLevel: itemLevel,
			generated: true,
			phase: payload.phase ?? defaultPhase(itemLevel),
			action: payload.action ?? options.action ?? 'Build',
			communicativeGoal: payload.communicativeGoal,
			spokenCue:
				payload.spokenCue ??
				'Say a rough version quickly before typing. Good enough comes first.',
			repairPrompts: unique(payload.repairPrompts ?? [promptEnglish]).slice(0, 3),
			sourceId: `ai-generated:${options.packId ?? now}`,
			curriculumWeeks: providedFrame?.weeks ?? stage.weeks,
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
				cefrLevel: itemLevel,
				construction,
				frameId,
				tenseFocus,
				vocabDomain,
				communicativeFunction,
				maxWords,
				utilityScore,
			}),
			keyVerb: payload.keyVerb,
			construction,
			npcLine: payload.npcLine,
			frameId,
			tenseFocus,
			vocabDomain,
			communicativeFunction,
			maxWords,
			utilityScore,
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

export async function ensureFrameSeedFallback(
	userId: string,
	options: GeneratedSentenceOptions
) {
	const targetLevel = normaliseTargetLevel(options.targetLevel)
	const frames = getGenerationFramesForWeek(options.programWeek, {
		targetLevel,
		action: options.action,
		limit: 18,
	}).filter((frame) => frame.cefrLevel === targetLevel)
	if (!frames.length) return []

	return saveGeneratedExercises(
		userId,
		frames.map((frame) => ({
			promptEnglish: frame.seedEnglish,
			targetItalian: frame.seedItalian,
			acceptedItalian: [frame.seedItalian],
			hints: frame.slotHints.slice(0, 2),
			tags: frame.tags,
			phraseFamily: frame.label,
			action: options.action ?? frame.label,
			communicativeGoal: frame.label,
			spokenCue: 'Say the useful frame quickly, then type it once.',
			repairPrompts: [frame.seedEnglish],
			construction: `frame:${frame.id}`,
			frameId: frame.id,
			tenseFocus: frame.tenseFocus,
			vocabDomain: frame.vocabDomain,
			communicativeFunction: frame.communicativeFunction,
			maxWords: frame.maxWords,
			utilityScore: frame.utilityScore,
			cefrLevel: frame.cefrLevel,
		})),
		{
			...options,
			targetLevel,
			provider: 'fallback',
			packId: `frame-seed:${targetLevel}`,
		}
	)
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
	const refillAt = Math.max(6, Math.ceil(minFresh / 2))
	let generated = await loadGeneratedExercises(userId)
	const seenIds = await loadSeenProductionExerciseIds(userId)
	let freshEligible = generated.filter(
		(item) =>
			item.cefrLevel === targetLevel &&
			exerciseMatchesOptions(generatedItemToExercise(item), options) &&
			!seenIds.has(item.id)
	)

	if (freshEligible.length >= refillAt || typeof window === 'undefined') {
		return generated
	}

	if (
		!generated.some(
			(item) => item.cefrLevel === targetLevel && item.source === 'ai'
		)
	) {
		await restoreGeneratedSentenceLibrary(userId, { ...options, targetLevel })
		generated = await loadGeneratedExercises(userId)
		freshEligible = generated.filter(
			(item) =>
				item.cefrLevel === targetLevel &&
				exerciseMatchesOptions(generatedItemToExercise(item), options) &&
				!seenIds.has(item.id)
		)
		if (freshEligible.length >= refillAt) return generated
	}

	const stage = getCurriculumStage(options.programWeek)
	const generationFrames = getGenerationFramesForWeek(options.programWeek, {
		targetLevel,
		action: options.action,
		limit: 14,
	})
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
		const response = await apiFetch('/api/generate-sentence-pack', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				level: targetLevel,
				programWeek: options.programWeek,
				stage,
				activeTenseFocuses: getActiveTenseFocusesForWeek(options.programWeek),
				recognitionOnlyTenses,
				conversationFrames: generationFrames,
				sceneId: options.sceneId,
				sceneTitle: options.sceneTitle,
				action: options.action,
				sentenceLength: options.sentenceLength ?? 'medium',
				targetCount:
					options.targetCount ??
					Math.min(24, Math.max(packSize, minFresh - freshEligible.length)),
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

export async function restoreGeneratedSentenceLibrary(
	userId: string,
	options: GeneratedSentenceOptions
) {
	const targetLevel = normaliseTargetLevel(options.targetLevel)
	try {
		const response = await apiFetch(
			`/api/generated-library?kind=sentences&level=${targetLevel}`
		)
		if (!response.ok) return []
		const data = (await response.json()) as { packs?: GeneratedPackResponse[] }
		const restored: GeneratedExerciseItem[] = []
		for (const pack of data.packs ?? []) {
			restored.push(
				...(await saveGeneratedExercises(userId, pack.exercises ?? [], {
					...options,
					programWeek: pack.programWeek ?? options.programWeek,
					sceneId: pack.sceneId ?? options.sceneId,
					sceneTitle: pack.sceneTitle ?? options.sceneTitle,
					action: pack.action ?? options.action,
					targetLevel: pack.level ?? targetLevel,
					provider: pack.provider,
					packId: pack.packId,
				}))
			)
		}
		return restored
	} catch {
		return []
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

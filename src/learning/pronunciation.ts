import type { CefrLevel } from '@/learning/content'
import { getActiveTenseFocusesForWeek } from '@/learning/conversation-frames'
import { getCurriculumStage } from '@/learning/curriculum'
import { apiFetch } from '@/lib/api'
import {
	db,
	type GeneratedPronunciationPassage,
	type PronunciationAttempt,
} from '@/storage/db'

export type PronunciationPassage = {
	id: string
	title: string
	level: CefrLevel
	weeks: [number, number]
	text: string
	focus: string[]
	prepCue: string
	maxWords?: number
	utilityScore?: number
	source?: 'seed' | 'ai' | 'fallback'
}

export type PronunciationFeedback = {
	transcript: string
	intelligibilityScore: number
	passageCoverage: number
	rhythmScore: number
	problemSounds: string[]
	missedWords: string[]
	substitutions: Array<{ expected: string; heard: string }>
	shortFeedback: string
	practiceLines: string[]
	provider?: 'openai' | 'deterministic'
	passageId?: string
	createdAt?: string
}

export const pronunciationPassages: PronunciationPassage[] = [
	{
		id: 'core-family-morning',
		title: 'Family morning',
		level: 'A2',
		weeks: [1, 4],
		text: 'Oggi parlo con mia figlia. Le chiedo come sta e poi facciamo colazione insieme.',
		focus: ['open vowels', 'gli', 'steady endings'],
		prepCue: 'Read in two calm chunks. Do not rush the final vowels.',
	},
	{
		id: 'core-table-request',
		title: 'At the table',
		level: 'A2',
		weeks: [1, 4],
		text: 'Mi passi il sale, per favore? È sul tavolo, vicino al pane.',
		focus: ['mi passi', 'sale', 'vicino'],
		prepCue: 'Keep the request friendly and make the final vowels audible.',
	},
	{
		id: 'core-simple-question',
		title: 'Simple question',
		level: 'A2',
		weeks: [1, 4],
		text: 'Dove sono le chiavi? Le ho messe in cucina, ma ora non le trovo.',
		focus: ['dove sono', 'le ho', 'trovo'],
		prepCue: 'Read it as a real question, then slow down for le ho messe.',
	},
	{
		id: 'modal-everyday-plan',
		title: 'Everyday plan',
		level: 'A2',
		weeks: [5, 8],
		text: 'Posso venire più tardi, ma devo prima fare la spesa e chiamare mia madre.',
		focus: ['posso', 'devo', 'fare la spesa'],
		prepCue: 'Keep posso and devo light, then land clearly on the infinitives.',
	},
	{
		id: 'modal-cafe-plan',
		title: 'Before we leave',
		level: 'A2',
		weeks: [5, 8],
		text: 'Devo prendere un caffè prima di partire, ma posso essere veloce.',
		focus: ['devo prendere', 'prima di', 'veloce'],
		prepCue: 'Make devo prendere one smooth phrase and do not rush partire.',
	},
	{
		id: 'modal-family-help',
		title: 'Can I help',
		level: 'A2',
		weeks: [5, 8],
		text: 'Posso aiutarti in cucina? Dopo dobbiamo uscire tutti insieme.',
		focus: ['posso aiutarti', 'dobbiamo uscire', 'insieme'],
		prepCue: 'Keep the modal phrases light and connected.',
	},
	{
		id: 'past-real-life',
		title: 'What happened',
		level: 'A2',
		weeks: [9, 12],
		text: 'Ieri sono andato in centro. Ho visto un amico e gli ho raccontato il problema.',
		focus: ['sono andato', 'ho visto', 'gli ho'],
		prepCue: 'Pause after the first sentence, then keep gli ho as one small unit.',
	},
	{
		id: 'past-family-call',
		title: 'Phone call',
		level: 'A2',
		weeks: [9, 12],
		text: 'Stamattina ho chiamato mio fratello. Mi ha detto che arrivava più tardi.',
		focus: ['ho chiamato', 'mi ha detto', 'più tardi'],
		prepCue: 'Use one clean pause between the two short sentences.',
	},
	{
		id: 'past-shopping-problem',
		title: 'Small problem',
		level: 'A2',
		weeks: [9, 12],
		text: 'Ho comprato il pane, però ho dimenticato il latte e la frutta.',
		focus: ['ho comprato', 'però', 'dimenticato'],
		prepCue: 'Let però mark the turn in the sentence.',
	},
	{
		id: 'pronoun-control',
		title: 'Giving and telling',
		level: 'B1',
		weeks: [13, 16],
		text: 'Ho portato il documento a Maria. Poi le ho detto che poteva leggerlo domani.',
		focus: ['le ho', 'leggerlo', 'documento'],
		prepCue: 'Say the clear version first. Accuracy matters, but flow matters too.',
	},
	{
		id: 'pronoun-salt-table',
		title: 'It is on the table',
		level: 'B1',
		weeks: [13, 16],
		text: 'Il sale è sul tavolo. Lo prendo io e te lo passo subito.',
		focus: ['lo prendo', 'te lo passo', 'subito'],
		prepCue: 'Keep te lo as a small unit, not two heavy words.',
	},
	{
		id: 'pronoun-message',
		title: 'A quick message',
		level: 'B1',
		weeks: [13, 16],
		text: 'Ho scritto a Lucia e le ho spiegato il problema con calma.',
		focus: ['le ho', 'spiegato', 'con calma'],
		prepCue: 'Put a small stress on Lucia, then keep le ho light.',
	},
	{
		id: 'opinion-family-politics',
		title: 'A careful opinion',
		level: 'B1',
		weeks: [17, 20],
		text: "Secondo me la situazione può migliorare, però non sono sicuro che tutti siano d'accordo.",
		focus: ['secondo me', 'però', "d'accordo"],
		prepCue: "Let secondo me start the opinion gently, then slow down before d'accordo.",
	},
	{
		id: 'opinion-local-issue',
		title: 'Local issue',
		level: 'B1',
		weeks: [17, 20],
		text: 'Penso che il problema sia serio, ma forse possiamo parlarne dopo cena.',
		focus: ['penso che', 'sia serio', 'parlarne'],
		prepCue: 'Do not overthink sia; say the whole chunk smoothly.',
	},
	{
		id: 'opinion-soft-disagree',
		title: 'Soft disagreement',
		level: 'B1',
		weeks: [17, 20],
		text: "Capisco quello che dici, però non sono del tutto d'accordo.",
		focus: ['capisco', 'però', "d'accordo"],
		prepCue: 'Sound warm, not defensive. Keep the last phrase slow.',
	},
	{
		id: 'connected-turn',
		title: 'Connected turn',
		level: 'B1',
		weeks: [21, 24],
		text: 'Quando leggo una notizia, provo a spiegare perché è importante e che cosa cambierà.',
		focus: ['quando', 'perché', 'cosa cambierà'],
		prepCue: 'Make it one connected thought with a small pause after notizia.',
	},
	{
		id: 'connected-family-plan',
		title: 'Family plan',
		level: 'B1',
		weeks: [21, 24],
		text: 'Prima di uscire, voglio controllare se tutti hanno preso le chiavi.',
		focus: ['prima di', 'controllare se', 'le chiavi'],
		prepCue: 'Start slowly, then keep the second half moving.',
	},
	{
		id: 'connected-cultural-plan',
		title: 'Cultural plan',
		level: 'B1',
		weeks: [21, 24],
		text: 'Anche se sono stanco, verrei volentieri al cinema con voi.',
		focus: ['anche se', 'verrei', 'volentieri'],
		prepCue: 'Let anche se introduce the contrast, then relax into verrei.',
	},
	{
		id: 'a1-table-help',
		title: 'A simple table request',
		level: 'A1',
		weeks: [1, 24],
		text: 'Mi passi il pane? È qui sul tavolo.',
		focus: ['clear vowels', 'mi passi', 'pane'],
		prepCue: 'Use two short groups and let the question rise gently.',
	},
	{
		id: 'a1-family-today',
		title: 'Today with family',
		level: 'A1',
		weeks: [1, 24],
		text: 'Oggi resto a casa con la mia famiglia.',
		focus: ['oggi', 'resto', 'famiglia'],
		prepCue: 'Keep every final vowel clear and unhurried.',
	},
	{
		id: 'a1-cafe-order',
		title: 'A café order',
		level: 'A1',
		weeks: [1, 24],
		text: "Vorrei un caffè e un bicchiere d'acqua.",
		focus: ['vorrei', 'caffè', 'acqua'],
		prepCue: 'Join vorrei smoothly, then keep caffè clearly Italian.',
	},
	{
		id: 'b2-soft-disagreement',
		title: 'A qualified opinion',
		level: 'B2',
		weeks: [1, 24],
		text: "Capisco il tuo punto, ma non sono del tutto d'accordo.",
		focus: ['capisco', 'del tutto', "d'accordo"],
		prepCue: 'Keep the tone warm and make the qualification one smooth phrase.',
	},
	{
		id: 'b2-correct-detail',
		title: 'Correcting a detail',
		level: 'B2',
		weeks: [1, 24],
		text: 'Non proprio: intendevo domani mattina, non questa sera.',
		focus: ['non proprio', 'intendevo', 'questa sera'],
		prepCue: 'Pause after non proprio, then contrast the two times calmly.',
	},
	{
		id: 'b2-clear-consequence',
		title: 'A practical consequence',
		level: 'B2',
		weeks: [1, 24],
		text: 'Siamo in ritardo, quindi li avviso e ci vediamo direttamente lì.',
		focus: ['quindi', 'li avviso', 'direttamente'],
		prepCue: 'Let quindi carry the turn and keep the pronouns light.',
	},
	{
		id: 'c1-careful-reservation',
		title: 'A careful reservation',
		level: 'C1',
		weeks: [1, 24],
		text: 'A dire il vero, non ne sono del tutto convinto.',
		focus: ['a dire il vero', 'non ne sono', 'convinto'],
		prepCue: 'Use a measured opening, then let non ne sono flow together.',
	},
	{
		id: 'c1-reformulate',
		title: 'Reformulating clearly',
		level: 'C1',
		weeks: [1, 24],
		text: 'In altre parole, serve un approccio diverso e più pratico.',
		focus: ['in altre parole', 'approccio', 'più pratico'],
		prepCue: 'Pause briefly after the reformulation marker, then stay conversational.',
	},
	{
		id: 'c1-limit-claim',
		title: 'Limiting a claim',
		level: 'C1',
		weeks: [1, 24],
		text: 'Per quanto ne so, la decisione non è ancora definitiva.',
		focus: ['per quanto ne so', 'decisione', 'definitiva'],
		prepCue: 'Keep the opening light and place the emphasis on definitiva.',
	},
]

function stableHash(value: string) {
	let hash = 2166136261
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

function normaliseText(value: string) {
	return value
		.toLowerCase()
		.normalize('NFC')
		.replace(/[.,!?;:()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function wordCount(value: string) {
	return normaliseText(value).split(' ').filter(Boolean).length
}

function tokenSimilarity(a: string, b: string) {
	const aTokens = new Set(normaliseText(a).split(' ').filter(Boolean))
	const bTokens = new Set(normaliseText(b).split(' ').filter(Boolean))
	if (!aTokens.size || !bTokens.size) return 0
	let overlap = 0
	for (const token of aTokens) if (bTokens.has(token)) overlap += 1
	return overlap / Math.max(aTokens.size, bTokens.size)
}

function matchingPassages(
	programWeek: number,
	targetLevel: CefrLevel,
	generated: GeneratedPronunciationPassage[] = []
) {
	const candidates: PronunciationPassage[] = [...generated, ...pronunciationPassages]
	const matches = candidates.filter(
		(passage) =>
			passage.level === targetLevel &&
			programWeek >= passage.weeks[0] &&
			programWeek <= passage.weeks[1]
	)
	return matches.length
		? matches
		: pronunciationPassages.filter((passage) => passage.level === targetLevel)
}

export function getPronunciationPassage(
	programWeek: number,
	targetLevel: CefrLevel,
	dateKey?: string
) {
	const candidates = matchingPassages(programWeek, targetLevel)
	if (!dateKey || candidates.length === 1) return candidates[0]
	return candidates[stableHash(`${programWeek}:${targetLevel}:${dateKey}`) % candidates.length]
}

export async function selectPronunciationPassage(
	userId: string,
	programWeek: number,
	targetLevel: CefrLevel,
	dateKey: string
) {
	const generated = await db.generatedPronunciationPassages
		.where('userId')
		.equals(userId)
		.and((passage) => passage.retired !== 1 && passage.level === targetLevel)
		.toArray()
	const candidates = matchingPassages(programWeek, targetLevel, generated)
	if (candidates.length === 1) return candidates[0]
	const attempts = await db.pronunciationAttempts
		.where('userId')
		.equals(userId)
		.toArray()
	const candidateIds = new Set(candidates.map((passage) => passage.id))
	const relevant = attempts.filter((attempt) => candidateIds.has(attempt.passageId))
	const attemptedToday = new Set(
		relevant
			.filter((attempt) => attempt.dateKey === dateKey)
			.map((attempt) => attempt.passageId)
	)
	const pool =
		attemptedToday.size < candidates.length
			? candidates.filter((passage) => !attemptedToday.has(passage.id))
			: candidates
	const stats = new Map<string, { count: number; last: number }>()
	for (const attempt of relevant) {
		const current = stats.get(attempt.passageId) ?? { count: 0, last: 0 }
		stats.set(attempt.passageId, {
			count: current.count + 1,
			last: Math.max(current.last, new Date(attempt.createdAt).getTime()),
		})
	}
	return [...pool].sort((a, b) => {
		const aStats = stats.get(a.id) ?? { count: 0, last: 0 }
		const bStats = stats.get(b.id) ?? { count: 0, last: 0 }
		if (aStats.count !== bStats.count) return aStats.count - bStats.count
		if (aStats.last !== bStats.last) return aStats.last - bStats.last
		return (
			(stableHash(`${dateKey}:${a.id}`) % 1_000_000) -
			(stableHash(`${dateKey}:${b.id}`) % 1_000_000)
		)
	})[0]
}

type GeneratedPassagePayload = {
	title?: string
	level?: CefrLevel
	text?: string
	focus?: string[]
	prepCue?: string
	maxWords?: number
	utilityScore?: number
}

type PronunciationPackResponse = {
	packId?: string
	provider?: 'openai' | 'fallback'
	passages?: GeneratedPassagePayload[]
}

export async function saveGeneratedPronunciationPassages(
	userId: string,
	passages: GeneratedPassagePayload[],
	options: {
		targetLevel: CefrLevel
		programWeek: number
		provider?: 'openai' | 'fallback'
		packId?: string
	}
) {
	const stage = getCurriculumStage(options.programWeek)
	const existing = await db.generatedPronunciationPassages
		.where('userId')
		.equals(userId)
		.toArray()
	const seenTexts = [
		...pronunciationPassages.map((passage) => normaliseText(passage.text)),
		...existing.map((passage) => normaliseText(passage.text)),
	]
	const seen = new Set(seenTexts)
	const now = new Date().toISOString()
	const saved: GeneratedPronunciationPassage[] = []

	for (const passage of passages) {
		const text = passage.text?.trim() ?? ''
		const title = passage.title?.trim() ?? ''
		const maxWords = Math.max(8, Math.min(36, Math.round(passage.maxWords ?? 24)))
		const utilityScore = Math.max(
			0,
			Math.min(100, Math.round(passage.utilityScore ?? 80))
		)
		const textKey = normaliseText(text)
		if (!text || !title || seen.has(textKey)) continue
		if (seenTexts.some((existingText) => tokenSimilarity(existingText, textKey) >= 0.84)) {
			continue
		}
		if (passage.level && passage.level !== options.targetLevel) continue
		if (wordCount(text) > maxWords || utilityScore < 75) continue
		seen.add(textKey)
		seenTexts.push(textKey)
		const contentHash = stableHash(textKey).toString(36)
		saved.push({
			id: `${userId}:pronunciation-passage:${contentHash}`,
			userId,
			title,
			level: options.targetLevel,
			weeks: stage.weeks,
			text,
			focus: (passage.focus ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 4),
			prepCue:
				passage.prepCue?.trim() ||
				'Read in calm sense groups and keep the final vowels clear.',
			maxWords,
			utilityScore,
			source: options.provider === 'fallback' ? 'fallback' : 'ai',
			contentHash,
			createdAt: now,
			lastUsedAt: null,
			useCount: 0,
			retired: 0,
		})
	}

	if (saved.length) await db.generatedPronunciationPassages.bulkPut(saved)
	return saved
}

export async function restoreGeneratedPronunciationLibrary(
	userId: string,
	targetLevel: CefrLevel,
	programWeek: number
) {
	try {
		const response = await apiFetch(
			`/api/generated-library?kind=pronunciation&level=${targetLevel}`
		)
		if (!response.ok) return []
		const data = (await response.json()) as { packs?: PronunciationPackResponse[] }
		const restored: GeneratedPronunciationPassage[] = []
		for (const pack of data.packs ?? []) {
			restored.push(
				...(await saveGeneratedPronunciationPassages(
					userId,
					pack.passages ?? [],
					{
						targetLevel,
						programWeek,
						provider: pack.provider,
						packId: pack.packId,
					}
				))
			)
		}
		return restored
	} catch {
		return []
	}
}

export async function ensureGeneratedPronunciationPool(
	userId: string,
	options: { targetLevel: CefrLevel; programWeek: number; minFresh?: number }
) {
	const minFresh = Math.max(3, options.minFresh ?? 6)
	const refillAt = Math.max(2, Math.ceil(minFresh / 2))
	let allGenerated = await db.generatedPronunciationPassages
		.where('userId')
		.equals(userId)
		.and((passage) => passage.retired !== 1 && passage.level === options.targetLevel)
		.toArray()
	let generated = allGenerated.filter(
		(passage) =>
			options.programWeek >= passage.weeks[0] &&
			options.programWeek <= passage.weeks[1]
	)
	const attempts = await db.pronunciationAttempts
		.where('userId')
		.equals(userId)
		.toArray()
	const attemptedIds = new Set(attempts.map((attempt) => attempt.passageId))
	let fresh = generated.filter((passage) => !attemptedIds.has(passage.id))
	if (fresh.length >= refillAt || typeof window === 'undefined') return generated

	if (!generated.length) {
		await restoreGeneratedPronunciationLibrary(
			userId,
			options.targetLevel,
			options.programWeek
		)
		allGenerated = await db.generatedPronunciationPassages
			.where('userId')
			.equals(userId)
			.and(
				(passage) =>
					passage.retired !== 1 && passage.level === options.targetLevel
			)
			.toArray()
		generated = allGenerated.filter(
			(passage) =>
				options.programWeek >= passage.weeks[0] &&
				options.programWeek <= passage.weeks[1]
		)
		fresh = generated.filter((passage) => !attemptedIds.has(passage.id))
		if (fresh.length >= refillAt) return generated
	}

	try {
		const response = await apiFetch('/api/generate-pronunciation-pack', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				level: options.targetLevel,
				programWeek: options.programWeek,
				stage: getCurriculumStage(options.programWeek),
				activeTenseFocuses: getActiveTenseFocusesForWeek(options.programWeek),
				targetCount: Math.max(4, minFresh - fresh.length),
				weakSounds: Array.from(
					new Set(attempts.flatMap((attempt) => attempt.problemSounds))
				).slice(0, 8),
				avoidTexts: [
					...pronunciationPassages.map((passage) => passage.text),
					...allGenerated.map((passage) => passage.text),
				].slice(-180),
			}),
		})
		if (!response.ok) return generated
		const pack = (await response.json()) as PronunciationPackResponse
		await saveGeneratedPronunciationPassages(userId, pack.passages ?? [], {
			targetLevel: options.targetLevel,
			programWeek: options.programWeek,
			provider: pack.provider,
			packId: pack.packId,
		})
		return db.generatedPronunciationPassages
			.where('userId')
			.equals(userId)
			.and((passage) => passage.retired !== 1 && passage.level === options.targetLevel)
			.toArray()
	} catch {
		return generated
	}
}

export function pronunciationScoreLabel(score: number) {
	if (score >= 90) return 'excellent'
	if (score >= 80) return 'clear'
	if (score >= 65) return 'usable'
	if (score >= 45) return 'developing'
	return 'recorded'
}

export async function recordPronunciationAttempt(args: {
	userId: string
	sessionId?: string | null
	dateKey: string
	passage: PronunciationPassage
	feedback: PronunciationFeedback
	activeMs: number
}) {
	const now = new Date().toISOString()
	const attempt: PronunciationAttempt = {
		id: `${args.userId}:pronunciation:${now}:${args.passage.id}`,
		userId: args.userId,
		sessionId: args.sessionId ?? null,
		dateKey: args.dateKey,
		passageId: args.passage.id,
		passageTitle: args.passage.title,
		expectedText: args.passage.text,
		transcript: args.feedback.transcript,
		score: args.feedback.intelligibilityScore,
		passageCoverage: args.feedback.passageCoverage,
		rhythmScore: args.feedback.rhythmScore,
		problemSounds: args.feedback.problemSounds,
		missedWords: args.feedback.missedWords,
		practiceLines: args.feedback.practiceLines,
		provider: args.feedback.provider ?? null,
		activeMs: Math.max(0, Math.round(args.activeMs)),
		createdAt: now,
	}
	await db.pronunciationAttempts.put(attempt)
	return attempt
}

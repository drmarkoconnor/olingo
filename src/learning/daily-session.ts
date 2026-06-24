import { db, type DailySession, type DailySessionItem, type MistakeItem } from '@/storage/db'

export const sessionActivityLabels = {
	match: 'Match useful chunks',
	recall: 'Recall sentence starters',
	sentence: 'Build fast sentences',
	repair: 'Repair old mistakes',
	pronunciation: 'Read aloud',
	transfer: 'Video or article',
} as const

export type DailySessionBundle = {
	session: DailySession
	items: DailySessionItem[]
}

export type DailySessionOptions = {
	programWeek: number
	dailyGoal: number
	vocabularyCount: number
	sentenceCount: number
	repairCount: number
}

export type UnitResult = {
	activeMs?: number
	success?: boolean
	mistake?: boolean
	tags?: string[]
}

function unique(values: string[]) {
	return Array.from(new Set(values.filter(Boolean)))
}

export function getTodayDateKey(date = new Date()) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

export function sessionIdFor(userId: string, dateKey = getTodayDateKey()) {
	return `${userId}:${dateKey}`
}

function isDue(iso?: string | null) {
	if (!iso) return true
	return new Date(iso).getTime() <= Date.now()
}

function clampTarget(value: number, fallback: number, max: number) {
	if (!Number.isFinite(value) || value <= 0) return fallback
	return Math.max(1, Math.min(max, Math.round(value)))
}

export function buildDailyActivityDefinitions(options: DailySessionOptions) {
	const matchTarget = clampTarget(Math.min(options.vocabularyCount, 4), 4, 4)
	const recallTarget = clampTarget(Math.min(options.vocabularyCount, 3), 3, 3)
	const sentenceTarget = clampTarget(Math.min(options.sentenceCount, 10), 8, 10)
	const repairTarget = Math.max(0, Math.min(3, Math.round(options.repairCount)))

	return [
		{
			type: 'match' as const,
			label: sessionActivityLabels.match,
			targetCount: matchTarget,
		},
		{
			type: 'recall' as const,
			label: sessionActivityLabels.recall,
			targetCount: recallTarget,
		},
		{
			type: 'sentence' as const,
			label: sessionActivityLabels.sentence,
			targetCount: sentenceTarget,
		},
		...(repairTarget
			? [
					{
						type: 'repair' as const,
						label: sessionActivityLabels.repair,
						targetCount: repairTarget,
					},
			  ]
			: []),
		{
			type: 'pronunciation' as const,
			label: sessionActivityLabels.pronunciation,
			targetCount: 1,
		},
		{
			type: 'transfer' as const,
			label: sessionActivityLabels.transfer,
			targetCount: 1,
		},
	]
}

async function reconcileSessionDefinitions(
	session: DailySession,
	options: DailySessionOptions
) {
	const existingItems = await loadDailySessionItems(session.id)
	if (session.status === 'complete') return { session, items: existingItems }

	const definitions = buildDailyActivityDefinitions(options)
	const itemByType = new Map(existingItems.map((item) => [item.type, item]))

	const now = new Date().toISOString()
	const definitionItems: DailySessionItem[] = definitions.map(
		(definition, index): DailySessionItem => {
			const existing = itemByType.get(definition.type)
			if (existing) {
				const targetCount = Math.max(
					definition.targetCount,
					existing.completedCount
				)
				return {
					...existing,
					label: definition.label,
					sortOrder: index,
					targetCount,
					status:
						existing.completedCount >= targetCount ? 'complete' : existing.status,
					completedAt:
						existing.completedCount >= targetCount
							? existing.completedAt ?? now
							: existing.completedAt,
				}
			}
			return {
				id: `${session.id}:${definition.type}`,
				sessionId: session.id,
				userId: session.userId,
				dateKey: session.dateKey,
				type: definition.type,
				label: definition.label,
				sortOrder: index,
				targetCount: definition.targetCount,
				completedCount: 0,
				successCount: 0,
				mistakeCount: 0,
				activeMs: 0,
				status: 'active' as const,
				tags: [],
				startedAt: null,
				completedAt: null,
			}
		}
	)
	const mergedItems: DailySessionItem[] = [
		...definitionItems,
		...existingItems.filter(
			(item) => !definitions.some((definition) => definition.type === item.type)
		),
	]

	const completedCount = mergedItems.reduce(
		(total, item) => total + Math.min(item.completedCount, item.targetCount),
		0
	)
	const allComplete = mergedItems.every((item) => item.status === 'complete')
	const updatedSession: DailySession = {
		...session,
		plannedCount: mergedItems.reduce((total, item) => total + item.targetCount, 0),
		completedCount,
		status: allComplete ? 'complete' : 'active',
		updatedAt: now,
		completedAt: allComplete ? session.completedAt ?? now : null,
	}

	await db.transaction('rw', db.dailySessions, db.dailySessionItems, async () => {
		await db.dailySessions.put(updatedSession)
		await db.dailySessionItems.bulkPut(mergedItems)
	})

	return {
		session: updatedSession,
		items: mergedItems.sort((a, b) => a.sortOrder - b.sortOrder),
	}
}

export async function getOrCreateDailySession(
	userId: string,
	options: DailySessionOptions,
	dateKey = getTodayDateKey()
): Promise<DailySessionBundle> {
	const id = sessionIdFor(userId, dateKey)
	const existing = await db.dailySessions.get(id)
	if (existing) {
		return reconcileSessionDefinitions(existing, options)
	}

	const now = new Date().toISOString()
	const definitions = buildDailyActivityDefinitions(options)
	const plannedCount = definitions.reduce(
		(total, item) => total + item.targetCount,
		0
	)
	const session: DailySession = {
		id,
		userId,
		dateKey,
		programWeek: options.programWeek,
		dailyGoal: options.dailyGoal,
		status: 'active',
		plannedCount,
		completedCount: 0,
		successCount: 0,
		mistakeCount: 0,
		activeMs: 0,
		revisionTags: [],
		startedAt: now,
		updatedAt: now,
		completedAt: null,
	}
	const items: DailySessionItem[] = definitions.map((definition, index) => ({
		id: `${id}:${definition.type}`,
		sessionId: id,
		userId,
		dateKey,
		type: definition.type,
		label: definition.label,
		sortOrder: index,
		targetCount: definition.targetCount,
		completedCount: 0,
		successCount: 0,
		mistakeCount: 0,
		activeMs: 0,
		status: 'active',
		tags: [],
		startedAt: null,
		completedAt: null,
	}))

	await db.transaction('rw', db.dailySessions, db.dailySessionItems, async () => {
		await db.dailySessions.put(session)
		await db.dailySessionItems.bulkPut(items)
	})

	return { session, items }
}

export async function loadDailySessionItems(sessionId: string) {
	const items = await db.dailySessionItems
		.where('sessionId')
		.equals(sessionId)
		.toArray()
	return items.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getActiveDailyItem(items: DailySessionItem[]) {
	return items.find((item) => item.status !== 'complete') ?? null
}

export function getDailySessionProgress(items: DailySessionItem[]) {
	const planned = items.reduce((total, item) => total + item.targetCount, 0)
	const completed = items.reduce(
		(total, item) => total + Math.min(item.completedCount, item.targetCount),
		0
	)
	return {
		planned,
		completed,
		percent: planned ? Math.round((completed / planned) * 100) : 0,
	}
}

export async function completeDailySessionUnit(
	itemId: string,
	result: UnitResult = {}
): Promise<DailySessionBundle> {
	const item = await db.dailySessionItems.get(itemId)
	if (!item) throw new Error('Daily session item not found')
	const session = await db.dailySessions.get(item.sessionId)
	if (!session) throw new Error('Daily session not found')

	const activeMs = Math.max(0, Math.round(result.activeMs ?? 0))
	const completedCount = Math.min(item.targetCount, item.completedCount + 1)
	const itemComplete = completedCount >= item.targetCount
	const now = new Date().toISOString()
	const successIncrement = result.success ? 1 : 0
	const mistakeIncrement = result.mistake ? 1 : 0
	const tags = unique([...item.tags, ...(result.tags ?? [])])

	const updatedItem: DailySessionItem = {
		...item,
		completedCount,
		successCount: item.successCount + successIncrement,
		mistakeCount: item.mistakeCount + mistakeIncrement,
		activeMs: item.activeMs + activeMs,
		status: itemComplete ? 'complete' : 'active',
		tags,
		startedAt: item.startedAt ?? now,
		completedAt: itemComplete ? now : item.completedAt ?? null,
	}

	await db.dailySessionItems.put(updatedItem)
	const items = await loadDailySessionItems(item.sessionId)
	const completed = items.reduce(
		(total, current) =>
			total + Math.min(current.completedCount, current.targetCount),
		0
	)
	const allComplete = items.every((current) => current.status === 'complete')
	const updatedSession: DailySession = {
		...session,
		completedCount: completed,
		successCount: session.successCount + successIncrement,
		mistakeCount: session.mistakeCount + mistakeIncrement,
		activeMs: session.activeMs + activeMs,
		revisionTags: unique([...session.revisionTags, ...(result.tags ?? [])]),
		status: allComplete ? 'complete' : 'active',
		updatedAt: now,
		completedAt: allComplete ? now : session.completedAt ?? null,
	}
	await db.dailySessions.put(updatedSession)

	return {
		session: updatedSession,
		items,
	}
}

export async function loadDueMistakes(userId: string, limit = 3) {
	const mistakes = await db.mistakes
		.where('userId')
		.equals(userId)
		.and(
			(mistake) =>
				mistake.status !== 'repaired' &&
				(!mistake.nextDueAt || isDue(mistake.nextDueAt))
		)
		.toArray()
	return mistakes
		.sort((a, b) => {
			const aDue = a.nextDueAt ? new Date(a.nextDueAt).getTime() : 0
			const bDue = b.nextDueAt ? new Date(b.nextDueAt).getTime() : 0
			if (aDue !== bDue) return aDue - bDue
			return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		})
		.slice(0, limit)
}

const adviceByTag: Array<{ tags: string[]; label: string }> = [
	{ tags: ['modal'], label: 'modal verbs' },
	{ tags: ['fare'], label: 'fare phrases' },
	{ tags: ['past', 'auxiliary', 'imperfect'], label: 'past tense choices' },
	{ tags: ['pronoun', 'clitic', 'indirect-object'], label: 'pronoun placement' },
	{ tags: ['agreement', 'article', 'gender', 'plural'], label: 'agreement and articles' },
	{ tags: ['question'], label: 'question forms' },
	{ tags: ['word-order', 'preposition'], label: 'sentence structure' },
	{ tags: ['pronunciation', 'word-shape'], label: 'pronunciation clarity' },
	{ tags: ['news', 'culture', 'politics'], label: 'topic vocabulary' },
	{ tags: ['vocab'], label: 'core vocabulary' },
]

export function getRevisionAdvice(tags: string[]) {
	const tagSet = new Set(tags)
	const advice = adviceByTag
		.filter((item) => item.tags.some((tag) => tagSet.has(tag)))
		.map((item) => item.label)
	return unique(advice).slice(0, 4)
}

export function mistakeToRevisionTags(mistake: MistakeItem) {
	return mistake.tags.length ? mistake.tags : ['structure']
}

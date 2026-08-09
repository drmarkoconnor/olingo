export type VideoSelectionHistory = {
	seenIds: string[]
	recentIds: string[]
	nextQueryIndex: number
	batchesShown: number
	updatedAt: string
}

const maxSeenVideos = 2_000
const maxRecentVideos = 24

export function emptyVideoSelectionHistory(): VideoSelectionHistory {
	return {
		seenIds: [],
		recentIds: [],
		nextQueryIndex: 0,
		batchesShown: 0,
		updatedAt: new Date(0).toISOString(),
	}
}

export function normaliseVideoSelectionHistory(
	value: Partial<VideoSelectionHistory> | null | undefined,
	queryCount: number
): VideoSelectionHistory {
	const fallback = emptyVideoSelectionHistory()
	const nextQueryIndex = Number.isFinite(value?.nextQueryIndex)
		? Math.max(0, Number(value?.nextQueryIndex)) % Math.max(1, queryCount)
		: 0
	return {
		seenIds: uniqueStrings(value?.seenIds).slice(-maxSeenVideos),
		recentIds: uniqueStrings(value?.recentIds).slice(0, maxRecentVideos),
		nextQueryIndex,
		batchesShown: Number.isFinite(value?.batchesShown)
			? Math.max(0, Number(value?.batchesShown))
			: fallback.batchesShown,
		updatedAt:
			typeof value?.updatedAt === 'string' && value.updatedAt
				? value.updatedAt
				: fallback.updatedAt,
	}
}

export function rotatedQueryIndexes(queryCount: number, startIndex: number) {
	if (queryCount <= 0) return []
	const start = Math.max(0, startIndex) % queryCount
	return Array.from({ length: queryCount }, (_, offset) => (start + offset) % queryCount)
}

export function selectFreshVideos<T extends { id: string }>(
	items: T[],
	history: VideoSelectionHistory,
	limit: number
) {
	const uniqueItems = uniqueById(items)
	const seen = new Set(history.seenIds)
	const recent = new Set(history.recentIds)
	const selected: T[] = []

	for (const group of [
		uniqueItems.filter((item) => !seen.has(item.id)),
		uniqueItems.filter((item) => !recent.has(item.id)),
		uniqueItems,
	]) {
		for (const item of group) {
			if (selected.some((candidate) => candidate.id === item.id)) continue
			selected.push(item)
			if (selected.length >= limit) break
		}
		if (selected.length >= limit) break
	}

	return {
		items: selected,
		freshCount: selected.filter((item) => !seen.has(item.id)).length,
	}
}

export function advanceVideoSelectionHistory(
	history: VideoSelectionHistory,
	selectedIds: string[],
	usedQueryIndex: number,
	queryCount: number,
	now = new Date()
): VideoSelectionHistory {
	const selected = uniqueStrings(selectedIds)
	return {
		seenIds: uniqueStrings([...history.seenIds, ...selected]).slice(-maxSeenVideos),
		recentIds: uniqueStrings([...selected, ...history.recentIds]).slice(
			0,
			maxRecentVideos
		),
		nextQueryIndex: queryCount
			? (Math.max(0, usedQueryIndex) + 1) % queryCount
			: 0,
		batchesShown: history.batchesShown + 1,
		updatedAt: now.toISOString(),
	}
}

function uniqueStrings(values: unknown) {
	if (!Array.isArray(values)) return []
	return Array.from(
		new Set(values.filter((value): value is string => typeof value === 'string' && Boolean(value)))
	)
}

function uniqueById<T extends { id: string }>(items: T[]) {
	const ids = new Set<string>()
	return items.filter((item) => {
		if (!item.id || ids.has(item.id)) return false
		ids.add(item.id)
		return true
	})
}

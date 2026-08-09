import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { methodNotAllowed } from './_shared/http'
import {
	advanceVideoSelectionHistory,
	normaliseVideoSelectionHistory,
	rotatedQueryIndexes,
	selectFreshVideos,
	type VideoSelectionHistory,
} from './_shared/source-selection'

const feeds = [
	{
		sourceName: 'ANSA Cultura',
		topic: 'culture',
		url: 'https://www.ansa.it/sito/notizie/cultura/cultura_rss.xml',
	},
	{
		sourceName: 'ANSA Lombardia',
		topic: 'Milan/Lombardy',
		url: 'https://www.ansa.it/lombardia/notizie/lombardia_rss.xml',
	},
	{
		sourceName: 'ANSA Top News',
		topic: 'news',
		url: 'https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml',
	},
]

const rssCacheTtlMs = 30 * 60 * 1000
const youtubePoolTtlMs = 12 * 60 * 60 * 1000
const youtubeBatchSize = 6
const youtubePoolSize = 18

type YouTubeQuery = {
	id: string
	label: string
	q?: string
	order?: 'date' | 'relevance'
	channelId?: string
	captioned?: boolean
	duration?: 'short' | 'medium' | 'long'
	format: 'guided lesson' | 'subtitled conversation' | 'animated lesson' | 'culture'
}

type SourceLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

const youtubeQueries: YouTubeQuery[] = [
	{
		id: 'coffee-break-italian',
		label: 'Coffee Break Italian lessons',
		channelId: 'UC3EGTNTkBjWhc_jsE5pMNdQ',
		order: 'date',
		duration: 'medium',
		format: 'guided lesson',
	},
	{
		id: 'easy-italian',
		label: 'Easy Italian street conversations',
		q: 'Easy Italian street interview Italian English subtitles',
		captioned: true,
		duration: 'medium',
		format: 'subtitled conversation',
	},
	{
		id: 'lucrezia',
		label: 'Learn Italian with Lucrezia',
		q: 'Learn Italian with Lucrezia everyday Italian',
		captioned: true,
		duration: 'medium',
		format: 'guided lesson',
	},
	{
		id: 'teacher-stefano',
		label: 'Teacher Stefano practical Italian',
		q: 'Teacher Stefano practical Italian conversation',
		captioned: true,
		duration: 'medium',
		format: 'guided lesson',
	},
	{
		id: 'podcast-italiano',
		label: 'Podcast Italiano with subtitles',
		q: 'Podcast Italiano subtitles everyday conversation',
		captioned: true,
		duration: 'medium',
		format: 'subtitled conversation',
	},
	{
		id: 'animated-italian',
		label: 'animated everyday Italian',
		q: 'italiano per stranieri cartone animato conversazione',
		captioned: true,
		duration: 'medium',
		format: 'animated lesson',
	},
	{
		id: 'coffee-family',
		label: 'coffee and family conversation',
		q: 'conversazione italiana caffe famiglia sottotitoli',
		captioned: true,
		duration: 'short',
		format: 'subtitled conversation',
	},
	{
		id: 'food-table',
		label: 'food and table conversation',
		q: 'italiano a tavola conversazione cibo sottotitoli',
		captioned: true,
		duration: 'short',
		format: 'subtitled conversation',
	},
	{
		id: 'sport-chat',
		label: 'sport and plans conversation',
		q: 'conversazione italiana sport programmi sottotitoli',
		captioned: true,
		duration: 'medium',
		format: 'subtitled conversation',
	},
	{
		id: 'milan-culture',
		label: 'Milan culture and everyday opinions',
		q: 'Milano cultura intervista italiano sottotitoli',
		captioned: true,
		duration: 'medium',
		format: 'culture',
	},
]

declare const Netlify:
	| {
			env: {
				get: (name: string) => string | undefined
			}
	  }
	| undefined

function getEnv(name: string) {
	if (typeof Netlify !== 'undefined') return Netlify.env.get(name)
	return undefined
}

function decodeXml(value: string) {
	return value
		.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.trim()
}

function stripHtml(value: string) {
	return decodeXml(value)
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function summarize(value: string, fallback: string) {
	const summary = stripHtml(value)
	if (!summary) return fallback
	return summary.length > 180 ? `${summary.slice(0, 177).trim()}...` : summary
}

function pick(block: string, tag: string) {
	const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
	return match ? decodeXml(match[1]) : ''
}

function makePrompt(title: string) {
	return `Ho letto questa notizia: "${title}". Che cosa ne pensi?`
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

function availableYoutubeQueries(level: SourceLevel) {
	const customQuery = getEnv('YOUTUBE_SEARCH_QUERY')?.trim()
	const queries = [...youtubeQueries]
	if (customQuery) {
		queries.push({
			id: `env-${slugify(customQuery).slice(0, 48) || 'custom'}`,
			label: 'your custom YouTube theme',
			q: customQuery,
			captioned: true,
			duration: 'medium',
			format: 'culture',
		})
	}
	const levelTerms: Record<SourceLevel, string> = {
		A1: 'beginner Italian A1',
		A2: 'elementary Italian A2',
		B1: 'intermediate Italian B1',
		B2: 'upper intermediate Italian B2',
		C1: 'advanced Italian C1',
	}
	return queries.map((query) => ({
		...query,
		id: `${query.id}-${level.toLowerCase()}`,
		q: query.channelId
			? query.q
			: [query.q, levelTerms[level]].filter(Boolean).join(' '),
	}))
}

async function readFeed(feed: (typeof feeds)[number]) {
	const response = await fetch(feed.url)
	if (!response.ok) return []
	const xml = await response.text()
	return xml
		.match(/<item\b[\s\S]*?<\/item>/gi)
		?.slice(0, 4)
		.map((block, index) => {
			const title = pick(block, 'title')
			const summary = summarize(
				pick(block, 'description'),
				'Una notizia di oggi da trasformare in una domanda semplice in italiano.'
			)
			return {
				id: `${feed.sourceName}-${index}-${title}`.replace(/\W+/g, '-'),
				sourceName: feed.sourceName,
				title,
				link: pick(block, 'link'),
				topic: feed.topic,
				summary,
				publishedAt: pick(block, 'pubDate'),
				prompt: makePrompt(title),
			}
		})
		.filter((item) => item.title && item.link) ?? []
}

async function readYouTube(query: YouTubeQuery) {
	const rawApiKey = getEnv('YOUTUBE_API_KEY') || ''
	const keyShape = {
		present: rawApiKey.length > 0,
		length: rawApiKey.length,
		trimmedLength: rawApiKey.trim().length,
		startsWithAIza: rawApiKey.trim().startsWith('AIza'),
		hasWhitespace: /\s/.test(rawApiKey),
	}
	const apiKey = rawApiKey.trim()
	if (!apiKey) {
		return {
			items: [],
			status: 'not_configured',
			configured: false,
			error: null,
			keyShape,
			query,
		}
	}

	const params = new URLSearchParams({
		part: 'snippet',
		type: 'video',
		maxResults: String(youtubePoolSize),
		relevanceLanguage: 'it',
		regionCode: 'IT',
		safeSearch: 'moderate',
		videoEmbeddable: 'true',
		key: apiKey,
	})
	if (query.q) params.set('q', query.q)
	if (query.order) params.set('order', query.order)
	if (query.channelId) params.set('channelId', query.channelId)
	if (query.captioned) params.set('videoCaption', 'closedCaption')
	if (query.duration) params.set('videoDuration', query.duration)

	const response = await fetch(
		`https://www.googleapis.com/youtube/v3/search?${params.toString()}`
	)
	if (!response.ok) {
		let error = `${response.status} ${response.statusText}`
		try {
			const body = (await response.json()) as {
				error?: {
					message?: string
					errors?: Array<{ reason?: string }>
				}
			}
			const reason = body.error?.errors?.[0]?.reason
			error = [reason, body.error?.message].filter(Boolean).join(': ') || error
		} catch {}
		return {
			items: [],
			status: `error_${response.status}`,
			configured: true,
			error,
			keyShape,
			query,
		}
	}

	const data = (await response.json()) as {
		items?: Array<{
			id?: { videoId?: string }
			snippet?: {
				title?: string
				channelTitle?: string
				description?: string
				publishedAt?: string
				thumbnails?: {
					medium?: { url?: string }
					high?: { url?: string }
				}
			}
		}>
	}

	const items =
		data.items
			?.map((item) => {
				const videoId = item.id?.videoId
				const title = item.snippet?.title
				if (!videoId || !title) return null
				return {
					id: `youtube-${videoId}`,
					sourceName: item.snippet?.channelTitle || 'YouTube',
					title: decodeXml(title),
					link: `https://www.youtube.com/watch?v=${videoId}`,
					topic: 'video',
					summary: summarize(
						item.snippet?.description || '',
						'Guarda il video e prepara una frase utile per parlarne.'
					),
					thumbnailUrl:
						item.snippet?.thumbnails?.high?.url ||
						item.snippet?.thumbnails?.medium?.url,
					embedUrl: `https://www.youtube.com/embed/${videoId}`,
					publishedAt: item.snippet?.publishedAt,
					format: query.format,
					captioned: Boolean(query.captioned),
					searchLabel: query.label,
					prompt: `Ho trovato questo video: "${decodeXml(
						title
					)}". Ti sembra interessante? Perche?`,
				}
			})
			.filter((item): item is NonNullable<typeof item> => Boolean(item)) ?? []

	return {
		items,
		status: 'ok',
		configured: true,
		error: null,
		keyShape,
		query,
	}
}

type SourcesResponse = {
	items: Array<{
		id: string
		sourceName: string
		title: string
		link: string
		topic: string
		summary: string
		publishedAt: string
		prompt: string
		thumbnailUrl?: string
		embedUrl?: string
		format?: YouTubeQuery['format']
		captioned?: boolean
		searchLabel?: string
		fresh?: boolean
	}>
	diagnostics: {
		youtube: {
			configured: boolean
			status: string
			count: number
			error: string | null
			keyShape: {
				present: boolean
				length: number
				trimmedLength: number
				startsWithAIza: boolean
				hasWhitespace: boolean
			}
			query?: {
				id: string
				label: string
				q?: string
			}
			freshCount?: number
			seenCount?: number
			batchesShown?: number
		}
		rss: {
			count: number
		}
		cache?: {
			hit: boolean
		}
	}
	fetchedAt: string
}

type YouTubePool = Awaited<ReturnType<typeof readYouTube>>
type RssItem = Awaited<ReturnType<typeof readFeed>>[number]

function youtubePoolKey(query: YouTubeQuery, now = new Date()) {
	const slot = Math.floor(now.getTime() / youtubePoolTtlMs)
	return `youtube-pools-v3/${query.id}/${slot}`
}

async function loadYouTubePool(query: YouTubeQuery) {
	const store = getStore({ name: 'content-cache' })
	const key = youtubePoolKey(query)
	try {
		const cached = (await store.get(key, { type: 'json' })) as YouTubePool | null
		if (cached?.items) return { ...cached, cacheHit: true }
	} catch {}

	const pool = await readYouTube(query)
	if (pool.status === 'ok') {
		try {
			await store.setJSON(key, pool)
		} catch {}
	}
	return { ...pool, cacheHit: false }
}

async function loadRssItems() {
	const store = getStore({ name: 'content-cache' })
	const slot = Math.floor(Date.now() / rssCacheTtlMs)
	const key = `rss-pool-v2/${slot}`
	try {
		const cached = (await store.get(key, { type: 'json' })) as
			| { items: RssItem[] }
			| null
		if (cached?.items?.length) return { items: cached.items, cacheHit: true }
	} catch {}

	const items = (await Promise.all(feeds.map(readFeed))).flat()
	try {
		await store.setJSON(key, { items, fetchedAt: new Date().toISOString() })
	} catch {}
	return { items, cacheHit: false }
}

async function loadVideoHistory(userId: string, queryCount: number) {
	try {
		const store = getStore({ name: 'source-history', consistency: 'strong' })
		const value = (await store.get(
			`users/${encodeURIComponent(userId)}/youtube`,
			{ type: 'json' }
		)) as Partial<VideoSelectionHistory> | null
		return normaliseVideoSelectionHistory(value, queryCount)
	} catch {
		return normaliseVideoSelectionHistory(null, queryCount)
	}
}

async function writeVideoHistory(userId: string, history: VideoSelectionHistory) {
	try {
		const store = getStore({ name: 'source-history', consistency: 'strong' })
		await store.setJSON(`users/${encodeURIComponent(userId)}/youtube`, history)
	} catch {}
}

async function loadPersonalisedVideos(userId: string, level: SourceLevel) {
	const queries = availableYoutubeQueries(level)
	const history = await loadVideoHistory(userId, queries.length)
	const indexes = rotatedQueryIndexes(queries.length, history.nextQueryIndex)
	let chosen:
		| {
				pool: Awaited<ReturnType<typeof loadYouTubePool>>
				queryIndex: number
				selection: ReturnType<typeof selectFreshVideos<YouTubePool['items'][number]>>
		  }
		| undefined

	for (const queryIndex of indexes.slice(0, 3)) {
		const pool = await loadYouTubePool(queries[queryIndex])
		const selection = selectFreshVideos(pool.items, history, youtubeBatchSize)
		if (!chosen || selection.freshCount > chosen.selection.freshCount) {
			chosen = { pool, queryIndex, selection }
		}
		if (!pool.configured || pool.status !== 'ok') break
		if (selection.items.length >= youtubeBatchSize && selection.freshCount >= youtubeBatchSize) {
			break
		}
	}

	if (!chosen) {
		const pool = await loadYouTubePool(queries[0])
		chosen = {
			pool,
			queryIndex: 0,
			selection: selectFreshVideos(pool.items, history, youtubeBatchSize),
		}
	}

	const seen = new Set(history.seenIds)
	const items = chosen.selection.items.map((item) => ({
		...item,
		fresh: !seen.has(item.id),
	}))
	const nextHistory = advanceVideoSelectionHistory(
		history,
		items.map((item) => item.id),
		chosen.queryIndex,
		queries.length
	)
	if (items.length) await writeVideoHistory(userId, nextHistory)

	return {
		...chosen.pool,
		items,
		freshCount: chosen.selection.freshCount,
		seenCount: nextHistory.seenIds.length,
		batchesShown: nextHistory.batchesShown,
	}
}

export default async (req: Request) => {
	if (req.method !== 'GET') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response
	const requestedLevel = new URL(req.url).searchParams.get('level')
	const level = ['A1', 'A2', 'B1', 'B2', 'C1'].includes(requestedLevel ?? '')
		? (requestedLevel as SourceLevel)
		: 'B1'

	const [youtube, rss] = await Promise.all([
		loadPersonalisedVideos(auth.user.id, level),
		loadRssItems(),
	])
	const rssItems = rss.items
	const payload: SourcesResponse = {
		items: [...youtube.items, ...rssItems].slice(0, 18),
		diagnostics: {
			youtube: {
				configured: youtube.configured,
				status: youtube.status,
				count: youtube.items.length,
				error: youtube.error,
				keyShape: youtube.keyShape,
				query: youtube.query,
				freshCount: youtube.freshCount,
				seenCount: youtube.seenCount,
				batchesShown: youtube.batchesShown,
			},
			rss: {
				count: rssItems.length,
			},
			cache: { hit: youtube.cacheHit && rss.cacheHit },
		},
		fetchedAt: new Date().toISOString(),
	}
	return Response.json(payload, {
		headers: { 'Cache-Control': 'private, no-store' },
	})
}

export const config = {
	path: '/api/italian-sources',
}

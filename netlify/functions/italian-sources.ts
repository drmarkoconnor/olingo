import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { methodNotAllowed } from './_shared/http'

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

const cacheTtlMs = 30 * 60 * 1000
const youtubeRotationMs = 6 * 60 * 60 * 1000

type YouTubeQuery = {
	id: string
	label: string
	q: string
	order?: 'date' | 'relevance'
}

const youtubeQueries: YouTubeQuery[] = [
	{
		id: 'food-family',
		label: 'food and family conversation',
		q: 'italiano cucina famiglia conversazione',
	},
	{
		id: 'culture-milan',
		label: 'Milan culture',
		q: 'Milano cultura italiana intervista',
	},
	{
		id: 'daily-life',
		label: 'everyday Italian life',
		q: 'vita quotidiana italiana conversazione',
	},
	{
		id: 'sport-chat',
		label: 'sport chat',
		q: 'sport italiano intervista partita',
	},
	{
		id: 'travel-cafe',
		label: 'travel and cafe situations',
		q: 'Italia viaggio bar caffe italiano',
	},
	{
		id: 'local-news',
		label: 'local news and opinions',
		q: 'notizie locali italiane opinione',
		order: 'date',
	},
	{
		id: 'culture-events',
		label: 'culture events',
		q: 'eventi culturali Italia oggi',
		order: 'date',
	},
	{
		id: 'family-routine',
		label: 'family routines',
		q: 'famiglia italiana vita quotidiana',
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

function activeYoutubeQuery(now = new Date()): YouTubeQuery {
	const override = getEnv('YOUTUBE_SEARCH_QUERY')?.trim()
	if (override) {
		return {
			id: `env-${slugify(override).slice(0, 48) || 'custom'}`,
			label: 'custom Netlify search query',
			q: override,
		}
	}
	const slot = Math.floor(now.getTime() / youtubeRotationMs)
	return youtubeQueries[slot % youtubeQueries.length]
}

function cacheKeyFor(query: YouTubeQuery, now = new Date()) {
	const slot = Math.floor(now.getTime() / cacheTtlMs)
	return `sources/${query.id}/${slot}`
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
		maxResults: '6',
		q: query.q,
		relevanceLanguage: 'it',
		regionCode: 'IT',
		safeSearch: 'moderate',
		videoEmbeddable: 'true',
		key: apiKey,
	})
	if (query.order) params.set('order', query.order)

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
				q: string
			}
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

async function readCachedSources(cacheKey: string) {
	try {
		const store = getStore({ name: 'content-cache' })
		const cached = (await store.get(cacheKey, { type: 'json' })) as
			| SourcesResponse
			| null
		if (!cached?.fetchedAt) return null
		const age = Date.now() - new Date(cached.fetchedAt).getTime()
		if (age > cacheTtlMs) return null
		return {
			...cached,
			diagnostics: {
				...cached.diagnostics,
				cache: { hit: true },
			},
		}
	} catch {
		return null
	}
}

async function writeCachedSources(cacheKey: string, payload: SourcesResponse) {
	try {
		const store = getStore({ name: 'content-cache' })
		await store.setJSON(cacheKey, payload)
	} catch {}
}

export default async (req: Request) => {
	if (req.method !== 'GET') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const query = activeYoutubeQuery()
	const cacheKey = cacheKeyFor(query)
	const cached = await readCachedSources(cacheKey)
	if (cached) return Response.json(cached)

	const [youtube, ...feedResults] = await Promise.all([
		readYouTube(query),
		...feeds.map(readFeed),
	])
	const rssItems = feedResults.flat()
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
			},
			rss: {
				count: rssItems.length,
			},
			cache: { hit: false },
		},
		fetchedAt: new Date().toISOString(),
	}
	await writeCachedSources(cacheKey, payload)
	return Response.json(payload)
}

export const config = {
	path: '/api/italian-sources',
}

import { getStore } from '@netlify/blobs'

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

const cacheKey = 'sources/latest'
const cacheTtlMs = 30 * 60 * 1000

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

async function readYouTube() {
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
		}
	}

	const query = getEnv('YOUTUBE_SEARCH_QUERY')?.trim() || 'italiano cultura Milano'
	const params = new URLSearchParams({
		part: 'snippet',
		type: 'video',
		maxResults: '6',
		q: query,
		relevanceLanguage: 'it',
		regionCode: 'IT',
		safeSearch: 'moderate',
		videoEmbeddable: 'true',
		key: apiKey,
	})

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

async function readCachedSources() {
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

async function writeCachedSources(payload: SourcesResponse) {
	try {
		const store = getStore({ name: 'content-cache' })
		await store.setJSON(cacheKey, payload)
	} catch {}
}

export default async () => {
	const cached = await readCachedSources()
	if (cached) return Response.json(cached)

	const [youtube, ...feedResults] = await Promise.all([
		readYouTube(),
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
			},
			rss: {
				count: rssItems.length,
			},
			cache: { hit: false },
		},
		fetchedAt: new Date().toISOString(),
	}
	await writeCachedSources(payload)
	return Response.json(payload)
}

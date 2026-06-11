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
			return {
				id: `${feed.sourceName}-${index}-${title}`.replace(/\W+/g, '-'),
				sourceName: feed.sourceName,
				title,
				link: pick(block, 'link'),
				topic: feed.topic,
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
		maxResults: '4',
		q: query,
		relevanceLanguage: 'it',
		regionCode: 'IT',
		safeSearch: 'moderate',
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
				publishedAt?: string
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

export default async () => {
	const [youtube, ...feedResults] = await Promise.all([
		readYouTube(),
		...feeds.map(readFeed),
	])
	const rssItems = feedResults.flat()
	return Response.json({
		items: [...youtube.items, ...rssItems].slice(0, 8),
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
		},
		fetchedAt: new Date().toISOString(),
	})
}

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
	const apiKey = getEnv('YOUTUBE_API_KEY')
	if (!apiKey) return []

	const query = getEnv('YOUTUBE_SEARCH_QUERY') || 'italiano cultura Milano'
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
	if (!response.ok) return []

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

	return (
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
	)
}

export default async () => {
	const results = await Promise.all([...feeds.map(readFeed), readYouTube()])
	return Response.json({
		items: results.flat().slice(0, 8),
		fetchedAt: new Date().toISOString(),
	})
}

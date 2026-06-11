export type ItalianSource = {
	id: string
	name: string
	type: 'rss' | 'video' | 'web'
	topic: string
	url: string
	notes: string
}

export type SourceItem = {
	id: string
	sourceName: string
	title: string
	link: string
	topic: string
	publishedAt?: string
	prompt: string
}

export const italianSources: ItalianSource[] = [
	{
		id: 'ansa-cultura',
		name: 'ANSA Cultura',
		type: 'rss',
		topic: 'culture',
		url: 'https://www.ansa.it/sito/notizie/cultura/cultura_rss.xml',
		notes: 'Headlines and links for culture discussion prompts.',
	},
	{
		id: 'ansa-lombardia',
		name: 'ANSA Lombardia',
		type: 'rss',
		topic: 'Milan/Lombardy',
		url: 'https://www.ansa.it/lombardia/notizie/lombardia_rss.xml',
		notes: 'Regional headlines useful for Milan-centred chat.',
	},
	{
		id: 'ansa-top',
		name: 'ANSA Top News',
		type: 'rss',
		topic: 'news',
		url: 'https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml',
		notes: 'Current affairs prompts at B1 and above.',
	},
	{
		id: 'rainews-culture',
		name: 'RaiNews Arti e spettacolo',
		type: 'web',
		topic: 'culture/video',
		url: 'https://www.rainews.it/archivio/artiespettacolo',
		notes: 'Culture and video material for later guided tasks.',
	},
	{
		id: 'youtube-italian-culture',
		name: 'YouTube Italian Culture',
		type: 'video',
		topic: 'video',
		url: 'https://www.youtube.com/results?search_query=italiano+cultura+Milano',
		notes: 'Live video prompts load from YouTube when the server key is configured.',
	},
]

export const fallbackSourceItems: SourceItem[] = [
	{
		id: 'fallback-culture-1',
		sourceName: 'ANSA Cultura',
		title: 'Una mostra importante apre a Milano',
		link: 'https://www.ansa.it/sito/notizie/cultura/cultura.shtml',
		topic: 'culture',
		prompt:
			'Ho letto che a Milano c e una mostra importante. Secondo te, vale la pena andarci?',
	},
	{
		id: 'fallback-lombardia-1',
		sourceName: 'ANSA Lombardia',
		title: 'Nuovi eventi culturali in Lombardia',
		link: 'https://www.ansa.it/lombardia/',
		topic: 'Milan/Lombardy',
		prompt:
			'Ho visto una notizia su un evento in Lombardia. Che cosa ti interessa di piu?',
	},
]

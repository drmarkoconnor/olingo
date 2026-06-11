import { useEffect, useState } from 'react'
import { CalendarDays, ExternalLink, Newspaper, Play, RefreshCw } from 'lucide-react'
import {
	fallbackSourceItems,
	italianSources,
	type ItalianSource,
	type SourceItem,
} from '@/learning/sources'

type SourceDiagnostics = {
	youtube?: {
		configured: boolean
		status: string
		count: number
		error: string | null
	}
	rss?: {
		count: number
	}
}

export default function Sources() {
	const [items, setItems] = useState<SourceItem[]>(fallbackSourceItems)
	const [loading, setLoading] = useState(false)
	const [activePrompt, setActivePrompt] = useState<SourceItem>(fallbackSourceItems[0])
	const [diagnostics, setDiagnostics] = useState<SourceDiagnostics | null>()
	const videoItems = items.filter(isVideoItem)
	const articleItems = items.filter((item) => !isVideoItem(item))

	async function loadSources() {
		setLoading(true)
		try {
			const response = await fetch('/api/italian-sources')
			if (!response.ok) throw new Error('source unavailable')
			const data = (await response.json()) as {
				items: SourceItem[]
				diagnostics?: SourceDiagnostics
			}
			setDiagnostics(data.diagnostics ?? null)
			if (data.items.length) {
				setItems(data.items)
				setActivePrompt(data.items[0])
			}
		} catch {
			setItems(fallbackSourceItems)
			setActivePrompt(fallbackSourceItems[0])
			setDiagnostics(null)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadSources()
	}, [])

	return (
		<div className="page-stack">
			<div className="page-heading">
				<p className="eyebrow">Italian sources</p>
				<h1>Culture feed</h1>
			</div>

			<section className="source-hero">
				<div>
					<p className="eyebrow">{activePrompt.sourceName}</p>
					<h2>{activePrompt.title}</h2>
					<p>{activePrompt.prompt}</p>
					<div className="action-row left">
						<a className="btn btn-primary" href={activePrompt.link} target="_blank" rel="noreferrer">
							<ExternalLink size={18} />
							Source
						</a>
						<button className="btn btn-secondary" type="button" onClick={loadSources}>
							<RefreshCw size={18} />
							{loading ? 'Loading' : 'Refresh'}
						</button>
					</div>
				</div>
			</section>

			<section className="source-panel">
				<div className="source-panel-header">
					<div>
						<p className="eyebrow">Video choices</p>
						<h2>Pick a clip</h2>
					</div>
					<span>{getSourceNotes(getYoutubeSource(), diagnostics)}</span>
				</div>

				{videoItems.length ? (
					<div className="video-choice-grid">
						{videoItems.map((item) => (
							<article
								className={
									activePrompt.id === item.id
										? 'video-choice-card active'
										: 'video-choice-card'
								}
								key={item.id}>
								<div className="video-frame">
									<iframe
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
										allowFullScreen
										src={item.embedUrl}
										title={item.title}
									/>
								</div>
								<div className="source-card-body">
									<span>{item.sourceName}</span>
									<strong>{item.title}</strong>
									<p>{item.summary}</p>
									<div className="source-card-actions">
										<button
											className="btn btn-secondary"
											type="button"
											onClick={() => setActivePrompt(item)}>
											<Play size={17} />
											Use this
										</button>
										<a href={item.link} target="_blank" rel="noreferrer">
											<ExternalLink size={16} />
											Open
										</a>
									</div>
								</div>
							</article>
						))}
					</div>
				) : (
					<div className="source-empty">
						<Play size={22} />
						<p>{getSourceNotes(getYoutubeSource(), diagnostics)}</p>
					</div>
				)}
			</section>

			<section className="source-panel">
				<div className="source-panel-header">
					<div>
						<p className="eyebrow">Newspaper prompts</p>
						<h2>Today in Italian</h2>
					</div>
					<span>{articleItems.length} articles loaded</span>
				</div>

				<div className="article-choice-grid">
					{articleItems.map((item) => (
						<article
							className={
								activePrompt.id === item.id
									? 'article-choice-card active'
									: 'article-choice-card'
							}
							key={item.id}>
							<div className="article-meta">
								<span>{item.sourceName}</span>
								<small>
									<CalendarDays size={14} />
									{formatSourceDate(item.publishedAt)}
								</small>
							</div>
							<strong>{item.title}</strong>
							<p>{item.summary}</p>
							<div className="source-card-actions">
								<button
									className="btn btn-secondary"
									type="button"
									onClick={() => setActivePrompt(item)}>
									<Newspaper size={17} />
									Use article
								</button>
								<a href={item.link} target="_blank" rel="noreferrer">
									<ExternalLink size={16} />
									Read
								</a>
							</div>
						</article>
					))}
				</div>
			</section>

			<div className="source-grid">
				{italianSources.map((source) => (
					<a
						className="source-card"
						href={getSourceUrl(source, items)}
						key={source.id}
						target="_blank"
						rel="noreferrer">
						<div className="stat-icon">
							{source.type === 'video' ? (
								<Play size={22} />
							) : (
								<Newspaper size={22} />
							)}
						</div>
						<span>{source.topic}</span>
						<strong>{source.name}</strong>
						<p>{getSourceNotes(source, diagnostics)}</p>
					</a>
				))}
			</div>
		</div>
	)
}

function isVideoItem(item: SourceItem) {
	return item.id.startsWith('youtube-') && Boolean(item.embedUrl)
}

function getYoutubeSource() {
	return italianSources.find((source) => source.id === 'youtube-italian-culture')!
}

function formatSourceDate(value?: string) {
	if (!value) return 'Today'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Today'
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
	}).format(date)
}

function getSourceUrl(source: ItalianSource, items: SourceItem[]) {
	if (source.id !== 'youtube-italian-culture') return source.url

	const firstYoutubeItem = items.find((item) => item.id.startsWith('youtube-'))
	return firstYoutubeItem?.link ?? source.url
}

function getSourceNotes(
	source: ItalianSource,
	diagnostics: SourceDiagnostics | null | undefined,
) {
	if (source.id !== 'youtube-italian-culture') return source.notes
	if (diagnostics === undefined) return 'Checking live YouTube source...'

	const youtube = diagnostics?.youtube
	if (youtube?.status === 'ok') {
		return `Live YouTube search is enabled. ${youtube.count} video prompts loaded.`
	}

	if (youtube?.configured) {
		return 'YouTube key is present, but live search did not return usable videos.'
	}

	return 'Add YOUTUBE_API_KEY in Netlify to enable live video prompts.'
}

import { useEffect, useState } from 'react'
import { ExternalLink, Newspaper, Play, RefreshCw } from 'lucide-react'
import {
	fallbackSourceItems,
	italianSources,
	type SourceItem,
} from '@/learning/sources'

export default function Sources() {
	const [items, setItems] = useState<SourceItem[]>(fallbackSourceItems)
	const [loading, setLoading] = useState(false)
	const [activePrompt, setActivePrompt] = useState<SourceItem>(fallbackSourceItems[0])

	async function loadSources() {
		setLoading(true)
		try {
			const response = await fetch('/api/italian-sources')
			if (!response.ok) throw new Error('source unavailable')
			const data = (await response.json()) as { items: SourceItem[] }
			if (data.items.length) {
				setItems(data.items)
				setActivePrompt(data.items[0])
			}
		} catch {
			setItems(fallbackSourceItems)
			setActivePrompt(fallbackSourceItems[0])
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

			<div className="source-grid">
				{items.map((item) => (
					<button
						type="button"
						className={
							activePrompt.id === item.id ? 'source-item active' : 'source-item'
						}
						key={item.id}
						onClick={() => setActivePrompt(item)}>
						<span>{item.sourceName}</span>
						<strong>{item.title}</strong>
					</button>
				))}
			</div>

			<div className="source-grid">
				{italianSources.map((source) => (
					<a
						className="source-card"
						href={source.url}
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
						<p>{source.notes}</p>
					</a>
				))}
			</div>
		</div>
	)
}


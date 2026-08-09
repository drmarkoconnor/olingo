import { useEffect, useRef, useState } from 'react'
import {
	CalendarDays,
	Captions,
	Eye,
	EyeOff,
	ExternalLink,
	Newspaper,
	Play,
	RefreshCw,
} from 'lucide-react'
import {
	fallbackSourceItems,
	italianSources,
	type ItalianSource,
	type SourceItem,
} from '@/learning/sources'
import { newsUnlockWeek, sourceContentUnlocked } from '@/learning/curriculum'
import { saveGeneratedExercises } from '@/learning/generated-sentences'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'

type SourceDiagnostics = {
	youtube?: {
		configured: boolean
		status: string
		count: number
		error: string | null
		query?: {
			id: string
			label: string
			q?: string
		}
		freshCount?: number
		seenCount?: number
		batchesShown?: number
	}
	rss?: {
		count: number
	}
}

type GeneratedPack = {
	id: string
	title: string
	level: string
	sourceName: string
	exercises: Array<{
		promptEnglish: string
		targetItalian: string
		phase: string
		action: string
	}>
	provider?: 'openai' | 'fallback'
	cached?: boolean
	savedCount?: number
}

type SourceReader = {
	id: string
	title: string
	sourceName: string
	sourceUrl: string
	publishedAt?: string
	level: string
	topic: string
	paragraphs: Array<{ italian: string; english: string }>
	glossary: Array<{ italian: string; english: string }>
	discussionPrompt: string
	provider: 'openai' | 'fallback'
	sourceMaterial?: 'article' | 'metadata'
	cached?: boolean
}

export default function Sources() {
	const { userId } = useAuth()
	const { programWeek, targetLevel } = useSettings()
	const [items, setItems] = useState<SourceItem[]>(fallbackSourceItems)
	const [loading, setLoading] = useState(false)
	const [packLoading, setPackLoading] = useState(false)
	const [activePrompt, setActivePrompt] = useState<SourceItem>(fallbackSourceItems[0])
	const [diagnostics, setDiagnostics] = useState<SourceDiagnostics | null>()
	const [generatedPack, setGeneratedPack] = useState<GeneratedPack | null>(null)
	const [reader, setReader] = useState<SourceReader | null>(null)
	const [readerLoading, setReaderLoading] = useState(false)
	const [readerError, setReaderError] = useState<string | null>(null)
	const [revealedParagraphs, setRevealedParagraphs] = useState<Set<number>>(
		new Set()
	)
	const readerRequestId = useRef(0)
	const readerSectionRef = useRef<HTMLDivElement>(null)
	const videoItems = items.filter(isVideoItem)
	const articleItems = items.filter((item) => !isVideoItem(item))
	const sourcesUnlocked = sourceContentUnlocked(programWeek)

	function selectPrompt(item: SourceItem) {
		readerRequestId.current += 1
		setActivePrompt(item)
		setReader(null)
		setReaderLoading(false)
		setReaderError(null)
		setRevealedParagraphs(new Set())
	}

	async function loadSources(fresh = false) {
		setLoading(true)
		try {
			const params = new URLSearchParams({ level: targetLevel })
			if (fresh) params.set('fresh', '1')
			const response = await apiFetch(`/api/italian-sources?${params.toString()}`)
			if (!response.ok) throw new Error('source unavailable')
			const data = (await response.json()) as {
				items: SourceItem[]
				diagnostics?: SourceDiagnostics
			}
			setDiagnostics(data.diagnostics ?? null)
			if (data.items.length) {
				setItems(data.items)
				selectPrompt(data.items[0])
			}
		} catch {
			setItems(fallbackSourceItems)
			selectPrompt(fallbackSourceItems[0])
			setDiagnostics(null)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void loadSources()
	}, [])

	useEffect(() => {
		if (!readerLoading && !reader && !readerError) return
		readerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}, [readerLoading, reader, readerError])

	async function openReader(item = activePrompt) {
		if (isVideoItem(item)) return
		const requestId = readerRequestId.current + 1
		readerRequestId.current = requestId
		setActivePrompt(item)
		setReader(null)
		setReaderLoading(true)
		setReaderError(null)
		setRevealedParagraphs(new Set())
		try {
			const response = await apiFetch('/api/source-reader', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sourceItem: item,
					level: targetLevel,
				}),
			})
			const text = await response.text()
			const data = text
				? (() => {
						try {
							return JSON.parse(text)
						} catch {
							return { error: text.slice(0, 180) }
						}
				  })()
				: null
			if (!response.ok) {
				throw new Error(
					data?.message ?? data?.error ?? `Reader unavailable (${response.status})`
				)
			}
			if (!isSourceReader(data)) {
				throw new Error(data?.error ?? 'The newspaper response was incomplete.')
			}
			if (readerRequestId.current !== requestId) return
			setReader(data)
		} catch (error) {
			if (readerRequestId.current !== requestId) return
			setReader(null)
			setReaderError(
				error instanceof Error ? error.message : 'Reader unavailable'
			)
		} finally {
			if (readerRequestId.current === requestId) setReaderLoading(false)
		}
	}

	function chooseSource(source: ItalianSource) {
		if (source.type === 'video') {
			const firstVideo = items.find((item) => item.id.startsWith('youtube-'))
			if (firstVideo) selectPrompt(firstVideo)
			return
		}
		const sourceItem =
			items.find((item) => item.sourceName === source.name) ??
			items.find((item) => item.topic === source.topic)
		if (sourceItem) openReader(sourceItem)
	}

	async function generatePack() {
		if (!sourcesUnlocked) return
		setPackLoading(true)
		try {
			const response = await apiFetch('/api/generate-content-pack', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sourceItem: activePrompt,
					level: targetLevel,
					programWeek,
				}),
			})
			if (!response.ok) throw new Error('pack unavailable')
			const data = (await response.json()) as GeneratedPack
			const saved = await saveGeneratedExercises(
				userId,
				data.exercises.map((exercise) => ({
					...exercise,
					phase: normaliseGeneratedPhase(exercise.phase),
					tags: ['source', 'news', activePrompt.topic],
					phraseFamily: 'Source conversation',
					communicativeGoal: 'Turn source input into one usable spoken sentence.',
					spokenCue: 'Say the idea aloud once before typing.',
					repairPrompts: [exercise.promptEnglish],
					construction: `source:${exercise.action}`,
				})),
				{
					targetLevel,
					programWeek,
					sentenceLength: 'long',
					sceneId: 'piazza-newsstand',
					sceneTitle: 'Piazza Newsstand',
					action: 'Summarise',
					provider: data.provider ?? 'fallback',
					packId: data.id,
				}
			)
			setGeneratedPack({ ...data, savedCount: saved.length })
		} catch {
			setGeneratedPack({
				id: `fallback-${activePrompt.id}`,
				title: activePrompt.title,
				level: targetLevel,
				sourceName: activePrompt.sourceName,
				exercises: [
					{
						promptEnglish: 'I read this news and it seems interesting.',
						targetItalian: 'Ho letto questa notizia e mi sembra interessante.',
						phase: 'produce',
						action: 'Summarise',
					},
					{
						promptEnglish: 'What do you think about it?',
						targetItalian: 'Che cosa ne pensi?',
						phase: 'speak',
						action: 'Ask view',
					},
				],
				cached: false,
				savedCount: 0,
			})
		} finally {
			setPackLoading(false)
		}
	}

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
							{isVideoItem(activePrompt) ? 'Source' : 'Original'}
						</a>
						{!isVideoItem(activePrompt) && (
							<button
								className="btn btn-primary"
								type="button"
								disabled={readerLoading}
								onClick={() => openReader(activePrompt)}>
								<Newspaper size={18} />
								{readerLoading ? 'Preparing' : 'Open newspaper'}
							</button>
						)}
						<button
							className="btn btn-secondary"
							type="button"
							disabled={loading}
							onClick={() => loadSources(true)}>
							<RefreshCw size={18} />
							{loading ? 'Finding clips' : 'New selection'}
						</button>
						<button
							className="btn btn-secondary"
							type="button"
							disabled={!sourcesUnlocked || packLoading}
							onClick={generatePack}>
							<Play size={18} />
							{packLoading
								? 'Making pack'
								: sourcesUnlocked
								? 'Make drills'
								: `Unlocks week ${newsUnlockWeek}`}
						</button>
					</div>
					{!sourcesUnlocked && (
						<p className="source-lock-note">
							Current topics become drills after the everyday and family base is
							stronger.
						</p>
					)}
				</div>
			</section>

			{(reader || readerLoading || readerError) && (
				<div className="reader-surface-anchor" ref={readerSectionRef}>
					{readerLoading && (
						<section className="source-panel reader-panel">
							<div className="source-empty">
								<RefreshCw className="spin" size={22} />
								<p>Setting today&apos;s learner edition...</p>
							</div>
						</section>
					)}
					{readerError && (
						<section className="source-panel reader-panel">
							<div className="feedback feedback-repair">
								<strong>Reader unavailable</strong>
								<span className="feedback-note">{readerError}</span>
							</div>
						</section>
					)}
					{reader && (
						<NewspaperReader
							reader={reader}
							revealedParagraphs={revealedParagraphs}
							onToggleParagraph={(index) =>
								setRevealedParagraphs((current) => {
									const next = new Set(current)
									if (next.has(index)) next.delete(index)
									else next.add(index)
									return next
								})
							}
						/>
					)}
				</div>
			)}

			{generatedPack && (
				<section className="source-panel generated-pack-panel">
					<div className="source-panel-header">
						<div>
							<p className="eyebrow">{generatedPack.sourceName}</p>
							<h2>{generatedPack.cached ? 'Cached drill pack' : 'Drill pack'}</h2>
						</div>
						<span>
							{generatedPack.savedCount
								? `${generatedPack.savedCount} added to practice`
								: `${generatedPack.exercises.length} production drills`}
						</span>
					</div>
					<div className="article-choice-grid">
						{generatedPack.exercises.map((exercise, index) => (
							<article className="article-choice-card" key={`${exercise.targetItalian}-${index}`}>
								<div className="article-meta">
									<span>{exercise.phase}</span>
									<small>{exercise.action}</small>
								</div>
								<strong>{exercise.promptEnglish}</strong>
								<p>{exercise.targetItalian}</p>
							</article>
						))}
					</div>
				</section>
			)}

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
									<div className="source-video-meta">
										<span>{item.sourceName}</span>
										<div>
											{item.fresh && <small>New to you</small>}
											{item.captioned && (
												<small>
													<Captions size={14} />
													Captions
												</small>
											)}
										</div>
									</div>
									<strong>{item.title}</strong>
									{item.format && <em>{item.format}</em>}
									<p>{item.summary}</p>
									<div className="source-card-actions">
										<button
											className="btn btn-secondary"
											type="button"
											onClick={() => selectPrompt(item)}>
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
						<p className="eyebrow">Il Tempo degli O&apos;Connor</p>
						<h2>Choose the front page</h2>
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
									onClick={() => selectPrompt(item)}>
									<Play size={17} />
									Use for drills
								</button>
								<button type="button" onClick={() => openReader(item)}>
									<Newspaper size={16} />
									Open edition
								</button>
								<a href={item.link} target="_blank" rel="noreferrer">
									<ExternalLink size={16} />
									Original
								</a>
							</div>
						</article>
					))}
				</div>
			</section>

			<div className="source-grid">
				{italianSources.map((source) => (
					<button
						className="source-card"
						key={source.id}
						type="button"
						onClick={() => chooseSource(source)}>
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
					</button>
				))}
			</div>
		</div>
	)
}

function NewspaperReader({
	reader,
	revealedParagraphs,
	onToggleParagraph,
}: {
	reader: SourceReader
	revealedParagraphs: Set<number>
	onToggleParagraph: (index: number) => void
}) {
	return (
		<section className="oconnor-paper" aria-label="Il Tempo degli O'Connor">
			<header className="paper-masthead">
				<div className="paper-dateline">
					<span>{formatEditionDate(reader.publishedAt)}</span>
					<span>{reader.level} learner edition</span>
				</div>
				<h2>Il Tempo degli O&apos;Connor</h2>
				<p>Notizie italiane, parole utili, idee da dire</p>
			</header>

			<div className="paper-layout">
				<article className="paper-story">
					<div className="paper-story-heading">
						<p>{reader.sourceName}</p>
						<h3>{reader.title}</h3>
						<span>
							{reader.sourceMaterial === 'article'
								? 'Adapted from the published report'
								: 'Adapted from the news summary'}
						</span>
					</div>

					<div className="paper-paragraphs">
						{reader.paragraphs.map((paragraph, index) => {
							const revealed = revealedParagraphs.has(index)
							return (
								<section className="paper-paragraph" key={`${reader.id}-${index}`}>
									<p lang="it">{paragraph.italian}</p>
									<button
										type="button"
										aria-expanded={revealed}
										onClick={() => onToggleParagraph(index)}>
										{revealed ? <EyeOff size={16} /> : <Eye size={16} />}
										{revealed ? 'Hide English' : 'Reveal English'}
									</button>
									{revealed && (
										<p className="paper-translation" lang="en">
											{paragraph.english}
										</p>
									)}
								</section>
							)
						})}
					</div>
				</article>

				<aside className="paper-sidebar">
					<section>
						<h4>Parole utili</h4>
						<dl>
							{reader.glossary.map((item) => (
								<div key={`${item.italian}-${item.english}`}>
									<dt>{item.italian}</dt>
									<dd>{item.english}</dd>
								</div>
							))}
						</dl>
					</section>
					<section>
						<h4>La tua opinione</h4>
						<p lang="it">{reader.discussionPrompt}</p>
					</section>
					<a href={reader.sourceUrl} target="_blank" rel="noreferrer">
						<ExternalLink size={16} />
						Original report
					</a>
				</aside>
			</div>
		</section>
	)
}

function isSourceReader(value: unknown): value is SourceReader {
	if (!value || typeof value !== 'object') return false
	const candidate = value as Partial<SourceReader>
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.title === 'string' &&
		Array.isArray(candidate.paragraphs) &&
		candidate.paragraphs.every(
			(paragraph) =>
				typeof paragraph?.italian === 'string' &&
				typeof paragraph?.english === 'string'
		) &&
		Array.isArray(candidate.glossary)
	)
}

function isVideoItem(item: SourceItem) {
	return item.id.startsWith('youtube-') && Boolean(item.embedUrl)
}

function normaliseGeneratedPhase(
	value: string
): 'warmup' | 'produce' | 'repair' | 'speak' {
	if (
		value === 'warmup' ||
		value === 'produce' ||
		value === 'repair' ||
		value === 'speak'
	) {
		return value
	}
	return 'produce'
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

function formatEditionDate(value?: string) {
	const date = value ? new Date(value) : new Date()
	const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
	return new Intl.DateTimeFormat('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	}).format(safeDate)
}

function getSourceNotes(
	source: ItalianSource,
	diagnostics: SourceDiagnostics | null | undefined,
) {
	if (source.id !== 'youtube-italian-culture') return source.notes
	if (diagnostics === undefined) return 'Checking live YouTube source...'

	const youtube = diagnostics?.youtube
	if (youtube?.status === 'ok') {
		const freshCount = youtube.freshCount ?? youtube.count
		const freshness =
			freshCount === youtube.count
				? `${freshCount} new-to-you clips`
				: `${freshCount} new and ${youtube.count - freshCount} rotated clips`
		const theme = youtube.query?.label ? ` ${youtube.query.label}.` : ''
		return `${freshness}.${theme}`
	}

	if (youtube?.configured) {
		return 'YouTube key is present, but live search did not return usable videos.'
	}

	return 'Add YOUTUBE_API_KEY in Netlify to enable live video prompts.'
}

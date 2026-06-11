import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
	ArrowRight,
	BookOpen,
	Check,
	Clock3,
	Layers,
	Lightbulb,
	MapPin,
	MessageCircle,
	Play,
	RotateCcw,
	Shuffle,
	Sparkles,
	Target,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
	getScene,
	getVocabularyForScene,
	scenes,
	type SceneVocabulary,
} from '@/learning/content'
import {
	loadDailySprint,
	submitExerciseAnswer,
	type SprintItem,
} from '@/learning/progress'
import type { EvaluationResult } from '@/learning/evaluator'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'

type FeedbackState = {
	result: EvaluationResult
	model: string
}

type PracticeMode = 'sentence' | 'match' | 'flashcards'

function shuffleWords(words: string[]) {
	return [...words].sort(() => Math.random() - 0.5)
}

export default function Study() {
	const { userId } = useAuth()
	const {
		targetLevel,
		sentenceLength,
		setTargetLevel,
		setSentenceLength,
	} = useSettings()
	const [queue, setQueue] = useState<SprintItem[]>([])
	const [index, setIndex] = useState(0)
	const [answer, setAnswer] = useState('')
	const [hintsRevealed, setHintsRevealed] = useState(0)
	const [wordBankVisible, setWordBankVisible] = useState(false)
	const [wordBankUsed, setWordBankUsed] = useState(false)
	const [wordBankWords, setWordBankWords] = useState<string[]>([])
	const [startedAt, setStartedAt] = useState(Date.now())
	const [loading, setLoading] = useState(true)
	const [feedback, setFeedback] = useState<FeedbackState | null>(null)
	const [completed, setCompleted] = useState(0)
	const [sceneAction, setSceneAction] = useState('Ask opinion')
	const [mode, setMode] = useState<PracticeMode>('sentence')

	useEffect(() => {
		let mounted = true
		setLoading(true)
		loadDailySprint(userId, 8, { targetLevel, sentenceLength })
			.then((items) => {
				if (!mounted) return
				setQueue(items)
				setIndex(0)
				setStartedAt(Date.now())
				setFeedback(null)
				setCompleted(0)
			})
			.finally(() => mounted && setLoading(false))
		return () => {
			mounted = false
		}
	}, [sentenceLength, targetLevel, userId])

	const current = queue[index]
	const scene = useMemo(
		() => (current ? getScene(current.exercise.sceneId) : scenes[0]),
		[current]
	)
	const progress = queue.length ? Math.round((completed / queue.length) * 100) : 0
	const visibleHints = current?.exercise.hints.slice(0, hintsRevealed) ?? []
	const vocabulary = useMemo(() => getVocabularyForScene(scene.id), [scene.id])

	useEffect(() => {
		if (!current) return
		setWordBankWords(
			shuffleWords(
				current.exercise.targetItalian
					.replace(/[.,!?;:]/g, '')
					.split(/\s+/)
					.filter(Boolean)
			)
		)
		setWordBankVisible(false)
		setWordBankUsed(false)
	}, [current?.exercise.id])

	async function handleSubmit(event: FormEvent) {
		event.preventDefault()
		if (!current || feedback || !answer.trim()) return
		const msUsed = Date.now() - startedAt
		const result = await submitExerciseAnswer({
			userId,
			item: current,
			answer,
			hintsUsed: hintsRevealed + (wordBankUsed ? 1 : 0),
			conceptHintsUsed: hintsRevealed,
			wordBankUsed,
			mode: 'sentence',
			msUsed,
		})
		setFeedback({
			result: result.result,
			model: current.exercise.targetItalian,
		})
	}

	function nextCard() {
		setCompleted((value) => value + 1)
		setIndex((value) => value + 1)
		setAnswer('')
		setHintsRevealed(0)
		setWordBankVisible(false)
		setWordBankUsed(false)
		setStartedAt(Date.now())
		setFeedback(null)
	}

	function revealHint() {
		if (!current) return
		setHintsRevealed((value) =>
			Math.min(value + 1, current.exercise.hints.length)
		)
	}

	function revealWordBank() {
		setWordBankVisible(true)
		setWordBankUsed(true)
	}

	function addWord(word: string) {
		if (feedback) return
		setAnswer((value) => `${value}${value.trim() ? ' ' : ''}${word}`)
	}

	if (loading) {
		return (
			<div className="today-shell">
				<div className="hero-scene skeleton" />
				<div className="panel">
					<p className="eyebrow">Preparing sprint</p>
					<h2>Building today&apos;s Italian gym...</h2>
				</div>
			</div>
		)
	}

	if (!current) {
		return (
			<div className="completion-screen">
				<div className="completion-badge">
					<Check size={38} />
				</div>
				<p className="eyebrow">Daily Sprint Complete</p>
				<h2>Good session. Your next drills are now scheduled.</h2>
				<p>
					You completed {completed} production prompts. Any rough answers have
					been sent to Mistake Gym for repair practice.
				</p>
				<div className="action-row">
					<Link className="btn btn-primary" to="/mistakes">
						<RotateCcw size={18} />
						Practise mistakes
					</Link>
					<Link className="btn btn-secondary" to="/scenes">
						<MapPin size={18} />
						Explore scenes
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="today-shell">
			<section
				className="hero-scene"
				style={
					{
						'--scene-image': `url(${scene.imageUrl})`,
						'--scene-accent': scene.accent,
					} as CSSProperties
				}>
				<div className="scene-overlay">
					<div className="scene-topline">
						<span className="scene-pill">
							<MapPin size={14} />
							{scene.location}
						</span>
						<span className="scene-pill">{scene.level}</span>
					</div>
					<div>
						<p className="eyebrow">Today&apos;s quest</p>
						<h2>{scene.title}</h2>
						<p>{scene.objective}</p>
					</div>
					<div className="scene-actions" aria-label="Scene actions">
						{scene.actions.map((action) => (
							<button
								className={action === sceneAction ? 'chip active' : 'chip'}
								key={action}
								type="button"
								onClick={() => setSceneAction(action)}>
								{action}
							</button>
						))}
					</div>
					<a
						className="photo-credit"
						href={scene.photoUrl}
						target="_blank"
						rel="noreferrer">
						{scene.photoCredit}
					</a>
				</div>
			</section>

			<section className="sprint-panel">
				<div className="sprint-header">
					<div>
						<p className="eyebrow">15 minute sprint</p>
						<h1>Build the sentence quickly</h1>
					</div>
					<div
						className="progress-ring"
						style={{ '--progress': `${progress}%` } as CSSProperties}
						aria-label={`${progress}% complete`}>
						<span>{progress}%</span>
					</div>
				</div>

				<div className="mode-row" aria-label="Practice mode">
					<button
						type="button"
						className={mode === 'sentence' ? 'mode-button active' : 'mode-button'}
						onClick={() => setMode('sentence')}>
						<MessageCircle size={18} />
						Sentence
					</button>
					<button
						type="button"
						className={mode === 'match' ? 'mode-button active' : 'mode-button'}
						onClick={() => setMode('match')}>
						<Shuffle size={18} />
						Match
					</button>
					<button
						type="button"
						className={
							mode === 'flashcards' ? 'mode-button active' : 'mode-button'
						}
						onClick={() => setMode('flashcards')}>
						<BookOpen size={18} />
						Cards
					</button>
				</div>

				<div className="level-row">
					<div className="segmented compact">
						{(['A1', 'A2', 'B1'] as const).map((level) => (
							<button
								type="button"
								key={level}
								className={targetLevel === level ? 'active' : ''}
								onClick={() => setTargetLevel(level)}>
								{level}
							</button>
						))}
					</div>
					<div className="segmented compact">
						{(['short', 'medium', 'long'] as const).map((length) => (
							<button
								type="button"
								key={length}
								className={sentenceLength === length ? 'active' : ''}
								onClick={() => setSentenceLength(length)}>
								{length}
							</button>
						))}
					</div>
				</div>

				<div className="quest-meta">
					<span>
						<Target size={15} />
						{current.exercise.phraseFamily}
					</span>
					<span>
						<Clock3 size={15} />
						Prompt {index + 1} of {queue.length}
					</span>
					<span>
						<MessageCircle size={15} />
						{sceneAction}
					</span>
				</div>

				{current.exercise.npcLine && (
					<div className="npc-line">
						<span>NPC</span>
						<p>{current.exercise.npcLine}</p>
					</div>
				)}

				{mode === 'match' && <VocabularyMatch vocabulary={vocabulary} />}

				{mode === 'flashcards' && <SceneFlashcards vocabulary={vocabulary} />}

				{mode === 'sentence' && (
				<form className="answer-card" onSubmit={handleSubmit}>
					<label htmlFor="answer">Say this in Italian</label>
					<p className="prompt">{current.exercise.promptEnglish}</p>
					<textarea
						id="answer"
						value={answer}
						disabled={Boolean(feedback)}
						onChange={(event) => setAnswer(event.target.value)}
						placeholder="Type your Italian sentence..."
						rows={4}
					/>
					{visibleHints.length > 0 && (
						<div className="hint-stack">
							{visibleHints.map((hint) => (
								<div className="hint" key={hint}>
									<Lightbulb size={15} />
									{hint}
								</div>
							))}
						</div>
					)}

					{wordBankVisible && (
						<div className="word-bank" aria-label="Word bank">
							{wordBankWords.map((word, wordIndex) => (
								<button
									type="button"
									key={`${word}-${wordIndex}`}
									onClick={() => addWord(word)}>
									{word}
								</button>
							))}
						</div>
					)}

					{feedback && (
						<div
							className={
								feedback.result.spellingOnly
									? 'feedback feedback-spelling'
									: feedback.result.accepted
									? 'feedback feedback-good'
									: 'feedback feedback-repair'
							}>
							<strong>{feedback.result.message}</strong>
							<p>{feedback.model}</p>
							{feedback.result.spellingIssues.length > 0 && (
								<div className="tag-row">
										{feedback.result.spellingIssues.map((issue) => (
											<span key={`${issue.answer}-${issue.correction}`}>
												{issue.answer} {'->'} {issue.correction}
											</span>
										))}
								</div>
							)}
							{feedback.result.errorTags.length > 0 && (
								<div className="tag-row">
									{feedback.result.errorTags.map((tag) => (
										<span key={tag}>{tag}</span>
									))}
								</div>
							)}
						</div>
					)}

					<div className="control-bar">
						<button
							className="btn btn-secondary"
							type="button"
							disabled={
								Boolean(feedback) ||
								hintsRevealed >= current.exercise.hints.length
							}
							onClick={revealHint}>
							<Lightbulb size={18} />
							Hint
						</button>
						<button
							className="btn btn-secondary"
							type="button"
							disabled={Boolean(feedback) || wordBankVisible}
							onClick={revealWordBank}>
							<Layers size={18} />
							Words
						</button>
						{feedback ? (
							<button className="btn btn-primary" type="button" onClick={nextCard}>
								<ArrowRight size={18} />
								Next
							</button>
						) : (
							<button className="btn btn-primary" type="submit">
								<Play size={18} />
								Check
							</button>
						)}
					</div>
				</form>
				)}

				<div className="micro-stats">
					<div>
						<Sparkles size={16} />
						<span>{completed} completed</span>
					</div>
					<div>
						<RotateCcw size={16} />
						<span>Mistakes become repairs</span>
					</div>
				</div>
			</section>
		</div>
	)
}

function VocabularyMatch({ vocabulary }: { vocabulary: SceneVocabulary[] }) {
	const [selectedItalian, setSelectedItalian] = useState<string | null>(null)
	const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set())
	const englishCards = useMemo(
		() => [...vocabulary].sort(() => Math.random() - 0.5),
		[vocabulary]
	)

	useEffect(() => {
		setSelectedItalian(null)
		setMatchedIds(new Set())
	}, [vocabulary])

	function chooseEnglish(item: SceneVocabulary) {
		if (!selectedItalian) return
		if (selectedItalian === item.id) {
			setMatchedIds((current) => new Set([...current, item.id]))
			setSelectedItalian(null)
		}
	}

	return (
		<div className="answer-card">
			<label>Scene vocabulary</label>
			<div className="match-score">
				<span>
					{matchedIds.size} / {vocabulary.length}
				</span>
			</div>
			<div className="match-board">
				<div className="match-column">
					{vocabulary.map((item) => (
						<button
							type="button"
							key={item.id}
							className={
								matchedIds.has(item.id)
									? 'match-token matched'
									: selectedItalian === item.id
									? 'match-token selected'
									: 'match-token'
							}
							disabled={matchedIds.has(item.id)}
							onClick={() => setSelectedItalian(item.id)}>
							{item.italian}
						</button>
					))}
				</div>
				<div className="match-column">
					{englishCards.map((item) => (
						<button
							type="button"
							key={item.id}
							className={
								matchedIds.has(item.id) ? 'match-token matched' : 'match-token'
							}
							disabled={matchedIds.has(item.id)}
							onClick={() => chooseEnglish(item)}>
							{item.english}
						</button>
					))}
				</div>
			</div>
			<div className="tag-row">
				{vocabulary.slice(0, 5).map((item) => (
					<span key={`${item.id}-pos`}>{item.partOfSpeech}</span>
				))}
			</div>
		</div>
	)
}

function SceneFlashcards({ vocabulary }: { vocabulary: SceneVocabulary[] }) {
	const [index, setIndex] = useState(0)
	const [revealed, setRevealed] = useState(false)
	const current = vocabulary[index % Math.max(vocabulary.length, 1)]

	useEffect(() => {
		setIndex(0)
		setRevealed(false)
	}, [vocabulary])

	if (!current) return null

	function next() {
		setIndex((value) => (value + 1) % vocabulary.length)
		setRevealed(false)
	}

	return (
		<div className="answer-card flashcard-mode">
			<label>Word card</label>
			<div className="word-card">
				<span>{current.partOfSpeech}</span>
				<strong>{current.italian}</strong>
				{revealed && <p>{current.english}</p>}
			</div>
			<div className="control-bar">
				<button
					className="btn btn-secondary"
					type="button"
					onClick={() => setRevealed(true)}>
					<Lightbulb size={18} />
					Reveal
				</button>
				<button className="btn btn-primary" type="button" onClick={next}>
					<ArrowRight size={18} />
					Next
				</button>
			</div>
		</div>
	)
}

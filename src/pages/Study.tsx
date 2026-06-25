import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
	ArrowRight,
	BookOpen,
	CalendarDays,
	Check,
	CheckCircle2,
	ExternalLink,
	Layers,
	Lightbulb,
	Loader2,
	MapPin,
	MessageCircle,
	Mic2,
	Newspaper,
	Play,
	RotateCcw,
	ShieldCheck,
	Sparkles,
	Square,
	Target,
	Volume2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
	getExerciseAction,
	getExercisePhase,
	getScene,
	cefrLevels,
	scenes,
	sprintPhaseLabels,
	type SceneVocabulary,
} from '@/learning/content'
import { getCurriculumStage, getSessionPlan } from '@/learning/curriculum'
import { loadSceneCards, type SceneCard } from '@/learning/scene-episodes'
import {
	completeDailySessionUnit,
	type DailySessionProgress,
	getActiveDailyItem,
	getDailySessionProgress,
	getOrCreateDailySession,
	getRevisionAdvice,
	getTodayDateKey,
	loadDueMistakes,
	mistakeToRevisionTags,
	sessionActivityLabels,
} from '@/learning/daily-session'
import {
	loadDailySprint,
	submitExerciseAnswer,
	submitMistakeRepair,
	type SprintItem,
} from '@/learning/progress'
import {
	fallbackSourceItems,
	type SourceItem,
} from '@/learning/sources'
import {
	getPronunciationPassage,
	pronunciationScoreLabel,
	recordPronunciationAttempt,
	type PronunciationFeedback,
} from '@/learning/pronunciation'
import type { EvaluationResult } from '@/learning/evaluator'
import {
	loadVocabularyReviewQueue,
	recordVocabularyReview,
	type VocabularyReviewCard,
} from '@/learning/vocabulary'
import { apiFetch, friendlyApiError } from '@/lib/api'
import { canTTS, speak } from '@/lib/tts'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'
import type { DailySession, DailySessionItem, MistakeItem } from '@/storage/db'

type FeedbackState = {
	result: EvaluationResult
	model: string
	msUsed: number
}

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

type TransferFeedback = EvaluationResult & {
	grammarScore?: number
	complexityScore?: number
	provider?: 'openai' | 'deterministic'
}

function friendlyPronunciationError(message: string) {
	if (
		/incorrect api key|invalid_api_key|openai_api_key|transcription key|401/i.test(
			message
		)
	) {
		return 'OpenAI transcription is not configured correctly. In Netlify, OPENAI_API_KEY must contain the actual sk-... key value only, not OPENAI_API_KEY=...'
	}
	return message
}

function shuffleWords(words: string[]) {
	return [...words].sort(() => Math.random() - 0.5)
}

function formatDuration(ms: number) {
	const totalSeconds = Math.max(0, Math.round(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	if (minutes <= 0) return `${seconds}s`
	return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function itemBonusCount(item: DailySessionItem) {
	return Math.max(0, item.completedCount - item.targetCount)
}

function itemCountLabel(item: DailySessionItem) {
	const required = `${Math.min(item.completedCount, item.targetCount)} / ${
		item.targetCount
	}`
	const bonus = itemBonusCount(item)
	return bonus ? `${required} + ${bonus}` : required
}

function isVideoItem(item: SourceItem) {
	return item.id.startsWith('youtube-') && Boolean(item.embedUrl)
}

function sourceTags(item: SourceItem) {
	const tags = ['input']
	if (/news|ansa|politic/i.test(`${item.topic} ${item.sourceName}`)) tags.push('news')
	if (/video|youtube/i.test(`${item.topic} ${item.sourceName}`)) tags.push('culture')
	return tags
}

export default function Study() {
	const { userId } = useAuth()
	const {
		dailyGoal,
		programWeek,
		selectedSceneAction,
		selectedSceneId,
		targetLevel,
		sentenceLength,
		setTargetLevel,
		setSentenceLength,
	} = useSettings()
	const [todayKey, setTodayKey] = useState(() => getTodayDateKey())
	const [session, setSession] = useState<DailySession | null>(null)
	const [sessionItems, setSessionItems] = useState<DailySessionItem[]>([])
	const [sentenceQueue, setSentenceQueue] = useState<SprintItem[]>([])
	const [repairMistakes, setRepairMistakes] = useState<MistakeItem[]>([])
	const [loading, setLoading] = useState(true)
	const [answer, setAnswer] = useState('')
	const [repairAnswer, setRepairAnswer] = useState('')
	const [hintsRevealed, setHintsRevealed] = useState(0)
	const [wordBankVisible, setWordBankVisible] = useState(false)
	const [wordBankUsed, setWordBankUsed] = useState(false)
	const [wordBankWords, setWordBankWords] = useState<string[]>([])
	const [spokenFirst, setSpokenFirst] = useState(false)
	const [feedback, setFeedback] = useState<FeedbackState | null>(null)
	const [repairFeedback, setRepairFeedback] = useState<FeedbackState | null>(null)
	const [pronunciationFeedback, setPronunciationFeedback] =
		useState<PronunciationFeedback | null>(null)
	const [pronunciationLoading, setPronunciationLoading] = useState(false)
	const [pronunciationError, setPronunciationError] = useState<string | null>(null)
	const [pronunciationAttempted, setPronunciationAttempted] = useState(false)
	const [bonusPractice, setBonusPractice] = useState(false)
	const [unitStartedAt, setUnitStartedAt] = useState(Date.now())
	const [sourceItems, setSourceItems] = useState<SourceItem[]>(fallbackSourceItems)
	const [sourceDiagnostics, setSourceDiagnostics] =
		useState<SourceDiagnostics | null>()
	const [sourceLoading, setSourceLoading] = useState(false)
	const [sourceReflection, setSourceReflection] = useState('')
	const [transferFeedback, setTransferFeedback] = useState<TransferFeedback | null>(null)
	const [transferLoading, setTransferLoading] = useState(false)
	const [transferError, setTransferError] = useState<string | null>(null)
	const [sceneCards, setSceneCards] = useState<SceneCard[]>([])
	const [vocabularyQueue, setVocabularyQueue] = useState<VocabularyReviewCard[]>([])

	useEffect(() => {
		const timer = window.setInterval(() => {
			const nextKey = getTodayDateKey()
			if (nextKey !== todayKey) setTodayKey(nextKey)
		}, 60_000)
		return () => window.clearInterval(timer)
	}, [todayKey])

	useEffect(() => {
		let mounted = true
		async function load() {
			setLoading(true)
			const sprintLimit = Math.max(16, Math.min(28, Math.round(dailyGoal / 2) + 10))
			const cards = await loadSceneCards(userId, programWeek)
			const selectedScene =
				cards.find((card) => card.id === selectedSceneId && card.available) ??
				cards.find((card) => card.available) ??
				scenes[0]
			const selectedAction = selectedScene.actions.includes(selectedSceneAction)
				? selectedSceneAction
				: selectedScene.actions[0]
			const queue = await loadDailySprint(userId, sprintLimit, {
				targetLevel,
				sentenceLength,
				sceneId: selectedScene.id,
				sceneTitle: selectedScene.title,
				sceneAction: selectedAction,
				programWeek,
			})
			const sentenceItems = queue
				.filter((item) => !item.sourceMistakeId)
				.slice(0, 10)
			const dueMistakes = await loadDueMistakes(userId, 3)
			const sceneId =
				sentenceItems[0]?.exercise.sceneId ??
				queue[0]?.exercise.sceneId ??
				selectedScene.id
			const vocabularyCards = await loadVocabularyReviewQueue(userId, sceneId, {
				programWeek,
				targetLevel,
				limit: 24,
				dateKey: todayKey,
			})
			const vocabularyCount = vocabularyCards.length
			const bundle = await getOrCreateDailySession(
				userId,
				{
					programWeek,
					dailyGoal,
					vocabularyCount,
					sentenceCount: sentenceItems.length,
					repairCount: dueMistakes.length,
				},
				todayKey
			)
			if (!mounted) return
			setSceneCards(cards)
			setVocabularyQueue(vocabularyCards)
			setSentenceQueue(sentenceItems)
			setRepairMistakes(dueMistakes)
			setSession(bundle.session)
			setSessionItems(bundle.items)
			setUnitStartedAt(Date.now())
			setAnswer('')
			setRepairAnswer('')
			setFeedback(null)
			setRepairFeedback(null)
			setPronunciationFeedback(null)
			setPronunciationError(null)
			setPronunciationLoading(false)
			setSpokenFirst(false)
			setSourceReflection('')
			setTransferFeedback(null)
			setTransferError(null)
			setTransferLoading(false)
			setBonusPractice(false)
		}
		load()
			.catch(console.error)
			.finally(() => mounted && setLoading(false))
		return () => {
			mounted = false
		}
	}, [
		dailyGoal,
		programWeek,
		sentenceLength,
		selectedSceneAction,
		selectedSceneId,
		targetLevel,
		todayKey,
		userId,
	])

	useEffect(() => {
		loadSources()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const activeItem = useMemo(
		() => getActiveDailyItem(sessionItems),
		[sessionItems]
	)
	const sentenceActivity = sessionItems.find((item) => item.type === 'sentence')
	const repairActivity = sessionItems.find((item) => item.type === 'repair')
	const pronunciationActivity = sessionItems.find(
		(item) => item.type === 'pronunciation'
	)
	const matchActivity = sessionItems.find((item) => item.type === 'match')
	const recallActivity = sessionItems.find((item) => item.type === 'recall')
	const bonusPracticeActive = Boolean(
		bonusPractice && !activeItem && sentenceActivity && sentenceQueue.length
	)
	const activeSessionItem =
		bonusPracticeActive && sentenceActivity
			? {
					...sentenceActivity,
					label: 'Bonus sentence practice',
					status: 'active' as const,
			  }
			: activeItem
	const currentSentenceIndex =
		sentenceQueue.length && sentenceActivity
			? bonusPracticeActive
				? sentenceActivity.completedCount % sentenceQueue.length
				: Math.min(
						sentenceActivity.completedCount,
						Math.max(0, sentenceQueue.length - 1)
				  )
			: 0
	const current = sentenceQueue[currentSentenceIndex]
	const currentMistake = repairMistakes[
		Math.min(repairActivity?.completedCount ?? 0, Math.max(0, repairMistakes.length - 1))
	]
	const scene = useMemo(
		() => {
			const fallback =
				sceneCards.find((card) => card.id === selectedSceneId) ?? scenes[0]
			if (!current) return fallback
			return (
				sceneCards.find((card) => card.id === current.exercise.sceneId) ??
				getScene(current.exercise.sceneId)
			)
		},
		[current, sceneCards, selectedSceneId]
	)
	const matchVocabulary = useMemo(
		() =>
			vocabularyQueue.slice(
				0,
				Math.max(matchActivity?.targetCount ?? 4, 4)
			),
		[vocabularyQueue, matchActivity?.targetCount]
	)
	const recallVocabulary = useMemo(
		() => {
			const start = Math.max(matchActivity?.targetCount ?? 4, 4)
			const target = Math.max(recallActivity?.targetCount ?? 3, 3)
			const next = vocabularyQueue.slice(start, start + target)
			return next.length ? next : vocabularyQueue.slice(0, target)
		},
		[vocabularyQueue, matchActivity?.targetCount, recallActivity?.targetCount]
	)
	const transferSource = useMemo(
		() => sourceItems.find(isVideoItem) ?? sourceItems[0] ?? fallbackSourceItems[0],
		[sourceItems]
	)
	const visibleHints = current?.exercise.hints.slice(0, hintsRevealed) ?? []
	const stage = useMemo(() => getCurriculumStage(programWeek), [programWeek])
	const sessionPlan = useMemo(() => getSessionPlan(dailyGoal), [dailyGoal])
	const pronunciationPassage = useMemo(
		() => getPronunciationPassage(programWeek),
		[programWeek]
	)
	const progress = getDailySessionProgress(sessionItems)
	const currentPhase = current ? getExercisePhase(current.exercise) : 'warmup'
	const currentAction = current ? getExerciseAction(current.exercise) : 'Build'
	const revisionAdvice = getRevisionAdvice(session?.revisionTags ?? [])

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
		setSpokenFirst(false)
		setAnswer('')
		setFeedback(null)
		setUnitStartedAt(Date.now())
	}, [current?.exercise.id])

	useEffect(() => {
		setRepairAnswer('')
		setRepairFeedback(null)
		setUnitStartedAt(Date.now())
	}, [currentMistake?.id])

	useEffect(() => {
		if (activeItem?.type !== 'pronunciation') return
		setPronunciationFeedback(null)
		setPronunciationError(null)
		setPronunciationLoading(false)
		setPronunciationAttempted(false)
		setUnitStartedAt(Date.now())
	}, [activeItem?.id, activeItem?.type])

	async function loadSources() {
		setSourceLoading(true)
		try {
			const response = await apiFetch('/api/italian-sources')
			if (!response.ok) throw new Error('source unavailable')
			const data = (await response.json()) as {
				items: SourceItem[]
				diagnostics?: SourceDiagnostics
			}
			setSourceDiagnostics(data.diagnostics ?? null)
			if (data.items.length) setSourceItems(data.items)
		} catch {
			setSourceItems(fallbackSourceItems)
			setSourceDiagnostics(null)
		} finally {
			setSourceLoading(false)
		}
	}

	async function recordUnit(
		item: DailySessionItem | null,
		result: {
			activeMs?: number
			success?: boolean
			mistake?: boolean
			tags?: string[]
		}
	) {
		if (!item) return
		const bundle = await completeDailySessionUnit(item.id, result)
		setSession(bundle.session)
		setSessionItems(bundle.items)
		setUnitStartedAt(Date.now())
	}

	async function recordVocabularyAttempt(
		card: SceneVocabulary,
		success: boolean,
		countsTowardSession: boolean,
		item: DailySessionItem | null
	) {
		await recordVocabularyReview(userId, card, success)
		if (!countsTowardSession) return
		await recordUnit(item, {
			activeMs: Date.now() - unitStartedAt,
			success,
			mistake: !success,
			tags: ['vocab', card.partOfSpeech],
		})
	}

	async function handleSentenceSubmit(event: FormEvent) {
		event.preventDefault()
		if (!current || feedback || !answer.trim()) return
		const msUsed = Date.now() - unitStartedAt
		const result = await submitExerciseAnswer({
			userId,
			item: current,
			answer,
			hintsUsed: hintsRevealed + (wordBankUsed ? 1 : 0),
			conceptHintsUsed: hintsRevealed,
			wordBankUsed,
			spokenFirst,
			mode: 'sentence',
			msUsed,
		})
		setFeedback({
			result: result.result,
			model: current.exercise.targetItalian,
			msUsed,
		})
	}

	async function nextSentence() {
		if (!feedback || !current) return
		await recordUnit(sentenceActivity ?? null, {
			activeMs: feedback.msUsed,
			success: feedback.result.communicative,
			mistake: !feedback.result.accepted,
			tags: feedback.result.errorTags.length
				? feedback.result.errorTags
				: feedback.result.accepted
				? []
				: current.exercise.tags,
		})
		setAnswer('')
		setHintsRevealed(0)
		setWordBankVisible(false)
		setWordBankUsed(false)
		setSpokenFirst(false)
		setFeedback(null)
	}

	async function handleRepairSubmit(event: FormEvent) {
		event.preventDefault()
		if (!currentMistake || repairFeedback || !repairAnswer.trim()) return
		const msUsed = Date.now() - unitStartedAt
		const result = await submitMistakeRepair({
			userId,
			mistake: currentMistake,
			answer: repairAnswer,
			msUsed,
		})
		setRepairFeedback({
			result: result.result,
			model: currentMistake.correctedItalian,
			msUsed,
		})
	}

	async function nextRepair() {
		if (!repairFeedback || !currentMistake) return
		await recordUnit(repairActivity ?? null, {
			activeMs: repairFeedback.msUsed,
			success: repairFeedback.result.communicative,
			mistake: !repairFeedback.result.communicative,
			tags: repairFeedback.result.errorTags.length
				? repairFeedback.result.errorTags
				: mistakeToRevisionTags(currentMistake),
		})
		setRepairAnswer('')
		setRepairFeedback(null)
	}

	async function assessPronunciation(audio: Blob) {
		setPronunciationLoading(true)
		setPronunciationError(null)
		setPronunciationAttempted(true)
		try {
			const form = new FormData()
			form.append('audio', audio, 'olingo-reading.webm')
			form.append('passageId', pronunciationPassage.id)
			form.append('expectedText', pronunciationPassage.text)
			const response = await apiFetch('/api/pronunciation-assessment', {
				method: 'POST',
				body: form,
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
					data?.message ??
						data?.error ??
						`Pronunciation score unavailable (${response.status})`
				)
			}
			setPronunciationFeedback(data as PronunciationFeedback)
		} catch (error) {
			setPronunciationError(
				error instanceof Error
					? friendlyPronunciationError(error.message)
					: 'Pronunciation score unavailable'
			)
		} finally {
			setPronunciationLoading(false)
		}
	}

	async function completePronunciation() {
		if (!pronunciationActivity) return
		const activeMs = Date.now() - unitStartedAt
		const score = pronunciationFeedback?.intelligibilityScore
		if (pronunciationFeedback) {
			await recordPronunciationAttempt({
				userId,
				sessionId: session?.id ?? null,
				dateKey: todayKey,
				passage: pronunciationPassage,
				feedback: pronunciationFeedback,
				activeMs,
			})
		}
		await recordUnit(pronunciationActivity ?? null, {
			activeMs,
			success: true,
			mistake: typeof score === 'number' ? score < 70 : false,
			tags: [
				'pronunciation',
				...(pronunciationFeedback && (score ?? 0) < 80
					? pronunciationFeedback.problemSounds.slice(0, 3)
					: []),
				...(!pronunciationFeedback ? ['unscored-reading'] : []),
			],
		})
		setPronunciationFeedback(null)
		setPronunciationError(null)
		setPronunciationAttempted(false)
	}

	function hearPronunciationPassage() {
		if (!canTTS()) return
		speak(pronunciationPassage.text, 'it-IT')
	}

	async function assessTransferSentence() {
		const answer = sourceReflection.trim()
		if (!answer || transferLoading) return null
		setTransferLoading(true)
		setTransferError(null)
		try {
			const response = await apiFetch('/api/evaluate-transfer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sourceItem: transferSource,
					answer,
					level: targetLevel,
					programWeek,
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
					friendlyApiError(
						response.status,
						data?.message ?? data?.error,
						`Transfer sentence could not be checked (${response.status})`
					)
				)
			}
			setTransferFeedback(data as TransferFeedback)
			return data as TransferFeedback
		} catch (error) {
			setTransferError(
				error instanceof Error
					? error.message
					: 'Transfer sentence could not be checked'
			)
			return null
		} finally {
			setTransferLoading(false)
		}
	}

	async function completeTransferActivity(item: DailySessionItem, allowUnscored = false) {
		if (!sourceReflection.trim()) return
		if (!transferFeedback && !allowUnscored) {
			await assessTransferSentence()
			return
		}
		await recordUnit(item, {
			activeMs: Date.now() - unitStartedAt,
			success: transferFeedback?.communicative ?? true,
			mistake: transferFeedback ? !transferFeedback.accepted : false,
			tags: transferFeedback?.errorTags.length
				? transferFeedback.errorTags
				: [
						...sourceTags(transferSource),
						...(transferFeedback ? [] : ['unscored-transfer']),
				  ],
		})
		setSourceReflection('')
		setTransferFeedback(null)
		setTransferError(null)
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

	function hearModel() {
		if (!current || !canTTS()) return
		speak(current.exercise.targetItalian, 'it-IT')
	}

	function continueBonusPractice() {
		setBonusPractice(true)
		setFeedback(null)
		setAnswer('')
		setHintsRevealed(0)
		setWordBankVisible(false)
		setWordBankUsed(false)
		setSpokenFirst(false)
		setUnitStartedAt(Date.now())
	}

	if (loading) {
		return (
			<div className="today-shell">
				<div className="hero-scene skeleton" />
				<div className="panel">
					<p className="eyebrow">Preparing today</p>
					<h2>Building your daily Italian session...</h2>
				</div>
			</div>
		)
	}

	if (session && !activeItem && !bonusPracticeActive) {
		return (
			<CompletionScreen
				session={session}
				items={sessionItems}
				advice={revisionAdvice}
				onContinue={continueBonusPractice}
			/>
		)
	}

	return (
		<div className="today-shell guided-today">
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
						<p className="eyebrow">Today&apos;s session</p>
						<h2>{stage.title}</h2>
						<p>{stage.goals.slice(0, 3).join(' - ')}</p>
					</div>
					<SessionChecklist items={sessionItems} activeItem={activeSessionItem} />
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
				<SessionProgressHeader
					dateKey={todayKey}
					dailyGoal={dailyGoal}
					progress={progress}
					activeMs={session?.activeMs ?? 0}
				/>

				<div className="curriculum-card daily-contract">
					<div>
						<span>{bonusPracticeActive ? 'Bonus practice' : 'Current focus'}</span>
						<strong>
							{bonusPracticeActive ? 'Keep building fast sentences' : stage.title}
						</strong>
					</div>
					<p>
						{progress.completed} of {progress.planned} required activities done
						{progress.bonus ? `, plus ${progress.bonus} bonus rep(s).` : '.'}
					</p>
				</div>

				<div className="session-plan" aria-label="Daily session plan">
					{sessionPlan.map((item) => (
						<div key={item.id}>
							<strong>{item.minutes}m</strong>
							<span>{item.label}</span>
						</div>
					))}
				</div>

				<div className="level-row">
					<div className="segmented compact">
						{cefrLevels.map((level) => (
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

				<ActivityShell item={activeSessionItem}>
					{activeSessionItem?.type === 'match' && (
						<GuidedVocabularyMatch
							vocabulary={matchVocabulary}
							item={activeSessionItem}
							onCardAttempt={(card, success, countsTowardSession) =>
								recordVocabularyAttempt(
									card,
									success,
									countsTowardSession,
									activeSessionItem
								)
							}
						/>
					)}

					{activeSessionItem?.type === 'recall' && (
						<GuidedRecallCards
							vocabulary={recallVocabulary}
							item={activeSessionItem}
							onCardAttempt={(card, success) =>
								recordVocabularyAttempt(card, success, true, activeSessionItem)
							}
						/>
					)}

					{activeSessionItem?.type === 'sentence' && current && (
						<SentenceBuilder
							answer={answer}
							current={current}
							currentAction={currentAction}
							currentPhase={currentPhase}
							feedback={feedback}
							hintsRevealed={hintsRevealed}
							spokenFirst={spokenFirst}
							visibleHints={visibleHints}
							wordBankVisible={wordBankVisible}
							wordBankWords={wordBankWords}
							onAddWord={addWord}
							onAnswer={setAnswer}
							onHearModel={hearModel}
							onNext={nextSentence}
							onRevealHint={revealHint}
							onRevealWordBank={revealWordBank}
							onSetSpokenFirst={setSpokenFirst}
							onSubmit={handleSentenceSubmit}
						/>
					)}

					{activeSessionItem?.type === 'repair' && currentMistake && (
						<DailyRepair
							answer={repairAnswer}
							feedback={repairFeedback}
							mistake={currentMistake}
							onAnswer={setRepairAnswer}
							onNext={nextRepair}
							onSubmit={handleRepairSubmit}
						/>
					)}

					{activeSessionItem?.type === 'pronunciation' && (
						<PronunciationActivity
							error={pronunciationError}
							feedback={pronunciationFeedback}
							canComplete={
								Boolean(pronunciationFeedback) ||
								pronunciationAttempted ||
								Boolean(pronunciationError)
							}
							loading={pronunciationLoading}
							passage={pronunciationPassage}
							onAssess={assessPronunciation}
							onComplete={completePronunciation}
							onHearModel={hearPronunciationPassage}
						/>
					)}

					{activeSessionItem?.type === 'transfer' && (
						<TransferActivity
							diagnostics={sourceDiagnostics}
							error={transferError}
							feedback={transferFeedback}
							item={transferSource}
							checking={transferLoading}
							loading={sourceLoading}
							reflection={sourceReflection}
							onAssess={assessTransferSentence}
							onComplete={() =>
								completeTransferActivity(activeSessionItem, Boolean(transferError))
							}
							onRefresh={loadSources}
							onReflection={(value) => {
								setSourceReflection(value)
								setTransferFeedback(null)
								setTransferError(null)
							}}
						/>
					)}
				</ActivityShell>

				<div className="micro-stats">
					<div>
						<Target size={16} />
						<span>{progress.totalCompleted} question(s) answered</span>
					</div>
					<div>
						<Sparkles size={16} />
						<span>{formatDuration(session?.activeMs ?? 0)} answering time</span>
					</div>
					{progress.bonus > 0 && (
						<div>
							<Play size={16} />
							<span>{progress.bonus} bonus rep(s)</span>
						</div>
					)}
					<div>
						<RotateCcw size={16} />
						<span>{session?.mistakeCount ?? 0} repair signal(s)</span>
					</div>
				</div>
			</section>
		</div>
	)
}

function SessionProgressHeader({
	activeMs,
	dailyGoal,
	dateKey,
	progress,
}: {
	activeMs: number
	dailyGoal: number
	dateKey: string
	progress: DailySessionProgress
}) {
	return (
		<div className="sprint-header guided-header">
			<div>
				<p className="eyebrow">
					<CalendarDays size={14} />
					{dateKey} - {dailyGoal} minute program
				</p>
				<h1>Today&apos;s finish line</h1>
				<p className="progress-copy">
					{progress.completed} of {progress.planned} required activities
					{progress.bonus ? `, plus ${progress.bonus} bonus` : ''} -{' '}
					{formatDuration(activeMs)} active answering
				</p>
			</div>
			<div
				className="progress-ring progress-ring-large"
				style={{ '--progress': `${progress.percent}%` } as CSSProperties}
				aria-label={`${progress.percent}% complete`}>
				<span>{progress.percent}%</span>
			</div>
		</div>
	)
}

function SessionChecklist({
	activeItem,
	items,
}: {
	activeItem: DailySessionItem | null
	items: DailySessionItem[]
}) {
	return (
		<div className="daily-checklist" aria-label="Today checklist">
			{items.map((item) => (
				<div
					className={
						item.status === 'complete'
							? 'daily-check complete'
							: activeItem?.id === item.id
							? 'daily-check active'
							: 'daily-check'
					}
					key={item.id}>
					<span>
						{item.status === 'complete' ? (
							<Check size={15} />
						) : (
							item.sortOrder + 1
						)}
					</span>
					<div>
						<strong>{item.label}</strong>
						<small>{itemCountLabel(item)}</small>
					</div>
				</div>
			))}
		</div>
	)
}

function ActivityShell({
	children,
	item,
}: {
	children: React.ReactNode
	item: DailySessionItem | null
}) {
	if (!item) return null
	return (
		<div className="guided-activity">
			<div className="guided-activity-top">
				<div>
					<p className="eyebrow">Up next</p>
					<h2>{sessionActivityLabels[item.type]}</h2>
				</div>
				<span>{itemCountLabel(item)}</span>
			</div>
			{children}
		</div>
	)
}

function SentenceBuilder({
	answer,
	current,
	currentAction,
	currentPhase,
	feedback,
	hintsRevealed,
	spokenFirst,
	visibleHints,
	wordBankVisible,
	wordBankWords,
	onAddWord,
	onAnswer,
	onHearModel,
	onNext,
	onRevealHint,
	onRevealWordBank,
	onSetSpokenFirst,
	onSubmit,
}: {
	answer: string
	current: SprintItem
	currentAction: string
	currentPhase: string
	feedback: FeedbackState | null
	hintsRevealed: number
	spokenFirst: boolean
	visibleHints: string[]
	wordBankVisible: boolean
	wordBankWords: string[]
	onAddWord: (word: string) => void
	onAnswer: (answer: string) => void
	onHearModel: () => void
	onNext: () => void
	onRevealHint: () => void
	onRevealWordBank: () => void
	onSetSpokenFirst: (value: boolean) => void
	onSubmit: (event: FormEvent) => void
}) {
	const frameMeta = [
		current.exercise.communicativeFunction,
		current.exercise.tenseFocus,
		current.exercise.vocabDomain,
	]
		.filter(Boolean)
		.map((value) => value!.replace(/-/g, ' '))

	return (
		<>
			<div className="quest-meta">
				<span>
					<Target size={15} />
					{current.exercise.phraseFamily}
				</span>
				<span>
					<MessageCircle size={15} />
					{currentAction}
				</span>
				<span>
					<ShieldCheck size={15} />
					{sprintPhaseLabels[currentPhase as keyof typeof sprintPhaseLabels]}
				</span>
				{frameMeta.map((value) => (
					<span key={value}>
						<Sparkles size={15} />
						{value}
					</span>
				))}
			</div>

			{current.exercise.npcLine && (
				<div className="npc-line">
					<span>NPC</span>
					<p>{current.exercise.npcLine}</p>
				</div>
			)}

			<form className="answer-card" onSubmit={onSubmit}>
				<label htmlFor="answer">Say this in Italian</label>
				<p className="prompt">{current.exercise.promptEnglish}</p>
				<div className={spokenFirst ? 'speak-gate done' : 'speak-gate'}>
					<div>
						<span>
							<Mic2 size={16} />
							Say it first
						</span>
						<p>
							{current.exercise.spokenCue ??
								'Make a rough spoken attempt before you type. It does not need to be perfect.'}
						</p>
					</div>
					<button
						className={spokenFirst ? 'btn btn-primary' : 'btn btn-secondary'}
						type="button"
						onClick={() => onSetSpokenFirst(true)}>
						<Mic2 size={18} />
						{spokenFirst ? 'Spoken' : 'I said it'}
					</button>
				</div>
				<textarea
					id="answer"
					value={answer}
					disabled={Boolean(feedback)}
					onChange={(event) => onAnswer(event.target.value)}
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
								onClick={() => onAddWord(word)}>
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
								: feedback.result.communicative
								? 'feedback feedback-communicative'
								: 'feedback feedback-repair'
						}>
						<strong>{feedback.result.message}</strong>
						<span className="feedback-note">{feedback.result.shortFeedback}</span>
						<p>{feedback.model}</p>
						<div className="feedback-actions">
							{canTTS() && (
								<button
									className="btn btn-secondary"
										type="button"
										onClick={onHearModel}>
										<Volume2 size={18} />
										AI model
								</button>
							)}
						</div>
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
						onClick={onRevealHint}>
						<Lightbulb size={18} />
						Hint
					</button>
					<button
						className="btn btn-secondary"
						type="button"
						disabled={Boolean(feedback) || wordBankVisible}
						onClick={onRevealWordBank}>
						<Layers size={18} />
						Words
					</button>
					{feedback ? (
						<button className="btn btn-primary" type="button" onClick={onNext}>
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
		</>
	)
}

function GuidedVocabularyMatch({
	item,
	onCardAttempt,
	vocabulary,
}: {
	item: DailySessionItem
	onCardAttempt: (
		card: SceneVocabulary,
		success: boolean,
		countsTowardSession: boolean
	) => void
	vocabulary: SceneVocabulary[]
}) {
	const targetVocabulary = vocabulary.slice(0, Math.max(item.targetCount, 1))
	const [selectedItalian, setSelectedItalian] = useState<string | null>(null)
	const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set())
	const targetKey = targetVocabulary.map((card) => card.id).join('|')
	const englishCards = useMemo(
		() => [...targetVocabulary].sort(() => Math.random() - 0.5),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[item.id, targetKey]
	)

	useEffect(() => {
		setSelectedItalian(null)
		setMatchedIds(new Set())
	}, [item.id, targetKey])

	function chooseEnglish(card: SceneVocabulary) {
		if (!selectedItalian) return
		if (selectedItalian === card.id && !matchedIds.has(card.id)) {
			setMatchedIds((current) => new Set([...current, card.id]))
			setSelectedItalian(null)
			onCardAttempt(card, true, true)
			return
		}
		const selectedCard = targetVocabulary.find(
			(vocabularyCard) => vocabularyCard.id === selectedItalian
		)
		if (selectedCard) onCardAttempt(selectedCard, false, false)
		setSelectedItalian(null)
	}

	if (!targetVocabulary.length) return null

	return (
		<div className="answer-card">
			<label>Match Italian to English</label>
			<div className="match-score">
				<span>{itemCountLabel(item)}</span>
			</div>
			<div className="match-board">
				<div className="match-column">
					{targetVocabulary.map((card) => (
						<button
							type="button"
							key={card.id}
							className={
								matchedIds.has(card.id)
									? 'match-token matched'
									: selectedItalian === card.id
									? 'match-token selected'
									: 'match-token'
							}
							disabled={matchedIds.has(card.id)}
							onClick={() => setSelectedItalian(card.id)}>
							{card.italian}
						</button>
					))}
				</div>
				<div className="match-column">
					{englishCards.map((card) => (
						<button
							type="button"
							key={card.id}
							className={
								matchedIds.has(card.id) ? 'match-token matched' : 'match-token'
							}
							disabled={matchedIds.has(card.id)}
							onClick={() => chooseEnglish(card)}>
							{card.english}
						</button>
					))}
				</div>
			</div>
			<div className="tag-row">
				{targetVocabulary.slice(0, 5).map((card) => (
					<span key={`${card.id}-pos`}>{card.partOfSpeech}</span>
				))}
			</div>
		</div>
	)
}

function GuidedRecallCards({
	item,
	onCardAttempt,
	vocabulary,
}: {
	item: DailySessionItem
	onCardAttempt: (card: SceneVocabulary, success: boolean) => void
	vocabulary: SceneVocabulary[]
}) {
	const [revealed, setRevealed] = useState(false)
	const card = vocabulary[item.completedCount % Math.max(vocabulary.length, 1)]

	useEffect(() => {
		setRevealed(false)
	}, [item.completedCount, item.id])

	if (!card) return null

	function complete(success: boolean) {
		setRevealed(false)
		onCardAttempt(card, success)
	}

	return (
		<div className="answer-card flashcard-mode">
			<label>Recall aloud</label>
			<div className="word-card">
				<span>{card.partOfSpeech}</span>
				<strong>{card.italian}</strong>
				{revealed && <p>{card.english}</p>}
			</div>
			<div className="control-bar">
				<button
					className="btn btn-secondary"
					type="button"
					onClick={() => setRevealed(true)}>
					<Lightbulb size={18} />
					Reveal
				</button>
				<button className="btn btn-secondary" type="button" onClick={() => complete(false)}>
					<RotateCcw size={18} />
					Review
				</button>
				<button className="btn btn-primary" type="button" onClick={() => complete(true)}>
					<Check size={18} />
					Knew it
				</button>
			</div>
		</div>
	)
}

function DailyRepair({
	answer,
	feedback,
	mistake,
	onAnswer,
	onNext,
	onSubmit,
}: {
	answer: string
	feedback: FeedbackState | null
	mistake: MistakeItem
	onAnswer: (value: string) => void
	onNext: () => void
	onSubmit: (event: FormEvent) => void
}) {
	return (
		<form className="answer-card" onSubmit={onSubmit}>
			<label>Repair from memory</label>
			<p className="prompt">{mistake.promptEnglish}</p>
			<div className="answer-comparison">
				<div>
					<span>Your previous answer</span>
					<p>{mistake.userAnswer || 'Blank answer'}</p>
				</div>
				<div>
					<span>Model</span>
					<p>{mistake.correctedItalian}</p>
				</div>
			</div>
			<div className="repair-drills">
				<span>
					<Mic2 size={15} />
					Say aloud, then type
				</span>
				<p>{mistake.repairPrompts?.[0] ?? mistake.promptEnglish}</p>
			</div>
			<textarea
				value={answer}
				disabled={Boolean(feedback)}
				onChange={(event) => onAnswer(event.target.value)}
				placeholder="Type the repaired Italian sentence..."
				rows={3}
			/>
			{feedback && (
				<div
					className={
						feedback.result.communicative
							? 'feedback feedback-good'
							: 'feedback feedback-repair'
					}>
					<strong>{feedback.result.message}</strong>
					<span className="feedback-note">{feedback.result.shortFeedback}</span>
					<p>{feedback.model}</p>
				</div>
			)}
			<div className="control-bar">
				{canTTS() && (
					<button
						className="btn btn-secondary"
							type="button"
							onClick={() => speak(mistake.correctedItalian, 'it-IT')}>
							<Volume2 size={18} />
							AI model
						</button>
				)}
				{feedback ? (
					<button className="btn btn-primary" type="button" onClick={onNext}>
						<ArrowRight size={18} />
						Next
					</button>
				) : (
					<button className="btn btn-primary" type="submit">
						<Play size={18} />
						Check repair
					</button>
				)}
			</div>
		</form>
	)
}

function preferredAudioMimeType() {
	if (typeof MediaRecorder === 'undefined') return ''
	return (
		[
			'audio/webm;codecs=opus',
			'audio/webm',
			'audio/mp4',
			'audio/ogg;codecs=opus',
		].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
	)
}

function PronunciationActivity({
	canComplete,
	error,
	feedback,
	loading,
	onAssess,
	onComplete,
	onHearModel,
	passage,
}: {
	canComplete: boolean
	error: string | null
	feedback: PronunciationFeedback | null
	loading: boolean
	onAssess: (audio: Blob) => void
	onComplete: () => void
	onHearModel: () => void
	passage: ReturnType<typeof getPronunciationPassage>
}) {
	const [recording, setRecording] = useState(false)
	const [recordingError, setRecordingError] = useState<string | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const recorderRef = useRef<MediaRecorder | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const canFinish = canComplete || Boolean(recordingError)

	useEffect(() => {
		return () => {
			if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
			streamRef.current?.getTracks().forEach((track) => track.stop())
		}
	}, [])

	async function startRecording() {
		setRecordingError(null)
		if (
			typeof navigator === 'undefined' ||
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === 'undefined'
		) {
			setRecordingError('This browser cannot record audio here.')
			return
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			streamRef.current = stream
			chunksRef.current = []
			const mimeType = preferredAudioMimeType()
			const recorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined
			)
			recorderRef.current = recorder
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data)
			}
			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, {
					type: recorder.mimeType || 'audio/webm',
				})
				stream.getTracks().forEach((track) => track.stop())
				streamRef.current = null
				if (blob.size > 0) onAssess(blob)
			}
			recorder.start()
			setRecording(true)
		} catch (recordError) {
			streamRef.current?.getTracks().forEach((track) => track.stop())
			streamRef.current = null
			setRecordingError(
				recordError instanceof Error
					? recordError.message
					: 'Microphone permission was not available.'
			)
		}
	}

	function stopRecording() {
		const recorder = recorderRef.current
		if (!recorder || recorder.state === 'inactive') return
		setRecording(false)
		recorder.stop()
	}

	return (
		<div className="answer-card pronunciation-card">
			<label>Read this Italian aloud</label>
			<div className="quest-meta">
				<span>
					<Mic2 size={15} />
					{passage.level}
				</span>
				{passage.focus.map((focus) => (
					<span key={focus}>{focus}</span>
				))}
			</div>
			<div className="reading-passage">
				<span>{passage.title}</span>
				<p>{passage.text}</p>
			</div>
			<div className="repair-drills">
				<span>
					<Mic2 size={15} />
					Reading cue
				</span>
				<p>{passage.prepCue}</p>
			</div>

			{(recordingError || error) && (
				<div className="feedback feedback-communicative">
					<strong>Reading recorded</strong>
					<span className="feedback-note">{recordingError ?? error}</span>
				</div>
			)}

			{loading && (
				<div className="recording-note">
					<Loader2 size={18} />
					Assessing your reading...
				</div>
			)}

			{feedback && (
				<div className="pronunciation-feedback">
					<div className="pronunciation-scores">
						<div>
							<strong>{feedback.intelligibilityScore}%</strong>
							<span>{pronunciationScoreLabel(feedback.intelligibilityScore)}</span>
						</div>
						<div>
							<strong>{feedback.passageCoverage}%</strong>
							<span>coverage</span>
						</div>
						<div>
							<strong>{feedback.rhythmScore}%</strong>
							<span>rhythm</span>
						</div>
					</div>
					<p className="feedback-note">{feedback.shortFeedback}</p>
					<div className="transcript-box">
						<span>Heard as</span>
						<p>{feedback.transcript || 'No clear transcript returned.'}</p>
					</div>
					{feedback.missedWords.length > 0 && (
						<div className="tag-row">
							{feedback.missedWords.map((word) => (
								<span key={word}>{word}</span>
							))}
						</div>
					)}
					{feedback.practiceLines.length > 0 && (
						<div className="practice-lines">
							<span>Try once more with</span>
							{feedback.practiceLines.slice(0, 3).map((line) => (
								<p key={line}>{line}</p>
							))}
						</div>
					)}
				</div>
			)}

			<div className="control-bar">
				{canTTS() && (
					<button className="btn btn-secondary" type="button" onClick={onHearModel}>
						<Volume2 size={18} />
						AI model
					</button>
				)}
				{recording ? (
					<button className="btn btn-danger" type="button" onClick={stopRecording}>
						<Square size={18} />
						Stop
					</button>
				) : (
					<button
						className="btn btn-secondary"
						disabled={loading}
						type="button"
						onClick={startRecording}>
						<Mic2 size={18} />
						Record
					</button>
				)}
				{canFinish && !loading && !recording && (
					<button className="btn btn-primary" type="button" onClick={onComplete}>
						<CheckCircle2 size={18} />
						{feedback ? 'Record score' : 'Complete reading'}
					</button>
				)}
			</div>
		</div>
	)
}

function TransferActivity({
	checking,
	diagnostics,
	error,
	feedback,
	item,
	loading,
	onAssess,
	onComplete,
	onRefresh,
	onReflection,
	reflection,
}: {
	checking: boolean
	diagnostics: SourceDiagnostics | null | undefined
	error: string | null
	feedback: TransferFeedback | null
	item: SourceItem
	loading: boolean
	onAssess: () => void
	onComplete: () => void
	onRefresh: () => void
	onReflection: (value: string) => void
	reflection: string
}) {
	const video = isVideoItem(item)
	const youtubeReady = diagnostics?.youtube?.status === 'ok'

	return (
		<div className="answer-card transfer-card">
			<label>{video ? 'Watch a short clip' : 'Read one article'}</label>
			<div className="transfer-media">
				{video ? (
					<div className="video-frame">
						<iframe
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
							src={item.embedUrl}
							title={item.title}
						/>
					</div>
				) : (
					<div className="article-transfer">
						<Newspaper size={30} />
						<strong>{item.sourceName}</strong>
					</div>
				)}
			</div>
			<div className="transfer-copy">
				<span>{item.sourceName}</span>
				<h3>{item.title}</h3>
				<p>{item.prompt}</p>
				{!youtubeReady && video && (
					<p className="source-lock-note">Video feed is using the current fallback.</p>
				)}
			</div>
			<textarea
				value={reflection}
				onChange={(event) => onReflection(event.target.value)}
				disabled={Boolean(feedback)}
				placeholder="Write one Italian sentence about it..."
				rows={3}
			/>
			{error && (
				<div className="feedback feedback-repair">
					<strong>Sentence check unavailable</strong>
					<span className="feedback-note">{error}</span>
				</div>
			)}
			{feedback && (
				<div
					className={
						feedback.communicative
							? 'feedback feedback-communicative'
							: 'feedback feedback-repair'
					}>
					<strong>{feedback.shortFeedback}</strong>
					<p>{feedback.correctedItalian}</p>
					<div className="pronunciation-scores">
						<div>
							<strong>{feedback.grammarScore ?? 0}%</strong>
							<span>grammar</span>
						</div>
						<div>
							<strong>{feedback.complexityScore ?? 0}%</strong>
							<span>complexity</span>
						</div>
						<div>
							<strong>{Math.round((feedback.confidence ?? 0) * 100)}%</strong>
							<span>confidence</span>
						</div>
					</div>
					{feedback.errorTags.length > 0 && (
						<div className="tag-row">
							{feedback.errorTags.map((tag) => (
								<span key={tag}>{tag}</span>
							))}
						</div>
					)}
				</div>
			)}
			<div className="control-bar">
				<a className="btn btn-secondary" href={item.link} target="_blank" rel="noreferrer">
					<ExternalLink size={18} />
					Open
				</a>
				<button className="btn btn-secondary" type="button" onClick={onRefresh}>
					<RotateCcw size={18} />
					{loading ? 'Refreshing' : 'Refresh'}
				</button>
				{feedback || error ? (
					<button className="btn btn-primary" type="button" onClick={onComplete}>
						<CheckCircle2 size={18} />
						{feedback ? 'Complete transfer' : 'Complete without score'}
					</button>
				) : (
					<button
						className="btn btn-primary"
						type="button"
						disabled={!reflection.trim() || checking}
						onClick={onAssess}>
						<CheckCircle2 size={18} />
						{checking ? 'Checking' : 'Check sentence'}
					</button>
				)}
			</div>
		</div>
	)
}

function CompletionScreen({
	advice,
	items,
	onContinue,
	session,
}: {
	advice: string[]
	items: DailySessionItem[]
	onContinue: () => void
	session: DailySession
}) {
	const requiredCompleted = items.reduce(
		(total, item) => total + Math.min(item.completedCount, item.targetCount),
		0
	)
	const totalCompleted = items.reduce(
		(total, item) => total + item.completedCount,
		0
	)
	const bonus = Math.max(0, totalCompleted - session.plannedCount)

	return (
		<div className="completion-screen daily-complete">
			<div className="completion-badge">
				<Check size={38} />
			</div>
			<p className="eyebrow">Daily Minimum Complete</p>
			<h2>Good, you have finished the minimum for today.</h2>
			<p className="completion-note">
				You can stop here, or keep building sentences. Extra practice is counted
				as bonus work.
			</p>
			<div className="completion-summary">
				<div>
					<strong>
						{requiredCompleted}/{session.plannedCount}
					</strong>
					<span>required</span>
				</div>
				<div>
					<strong>{bonus}</strong>
					<span>bonus reps</span>
				</div>
				<div>
					<strong>{session.successCount}</strong>
					<span>successful</span>
				</div>
				<div>
					<strong>{session.mistakeCount}</strong>
					<span>repair signals</span>
				</div>
				<div>
					<strong>{formatDuration(session.activeMs)}</strong>
					<span>active answering</span>
				</div>
			</div>
			<div className="completion-review">
				<h3>Today&apos;s checklist</h3>
				{items.map((item) => (
					<div className="metric-row" key={item.id}>
						<span>{item.label}</span>
						<strong>{itemCountLabel(item)}</strong>
					</div>
				))}
			</div>
			<div className="completion-review">
				<h3>Revise next</h3>
				{advice.length ? (
					<div className="tag-row">
						{advice.map((item) => (
							<span key={item}>{item}</span>
						))}
					</div>
				) : (
					<p>Keep the same sentence frames warm tomorrow.</p>
				)}
			</div>
			<div className="action-row">
				<button className="btn btn-primary" type="button" onClick={onContinue}>
					<Play size={18} />
					Continue building sentences
				</button>
				<Link className="btn btn-secondary" to="/sources">
					<BookOpen size={18} />
					Continue lightly
				</Link>
				<Link className="btn btn-secondary" to="/mistakes">
					<RotateCcw size={18} />
					Practise mistakes
				</Link>
			</div>
		</div>
	)
}

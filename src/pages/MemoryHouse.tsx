import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Check,
	Clock3,
	House,
	Lightbulb,
	Loader2,
	MapPin,
	RotateCcw,
	Route,
	Volume2,
} from 'lucide-react'
import SentenceVoiceRecorder from '@/components/SentenceVoiceRecorder'
import { useSentenceSpeech } from '@/hooks/useSentenceSpeech'
import { cefrLevels } from '@/learning/content'
import type { EvaluationResult } from '@/learning/evaluator'
import {
	atlasPosition,
	dueMemoryAnchors,
	memoryAnchorExercise,
	memoryAnchorRefs,
	memoryCueForLevel,
	memoryExerciseId,
	memoryRooms,
	memoryStatus,
	scheduleMemoryAnchorReview,
	type MemoryAnchorRef,
} from '@/learning/memory-house'
import { AssessmentUnavailableError, submitExerciseAnswer, type SprintItem } from '@/learning/progress'
import { createExerciseState } from '@/learning/scheduler'
import { speak } from '@/lib/tts'
import { db, type ExerciseState, type SpeakingDraft } from '@/storage/db'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'

type PracticeMode = 'route' | 'review'
type PracticePhase = 'learn' | 'recall'

type MemoryFeedback = {
	result: EvaluationResult
	model: string
	meaning: string
	msUsed: number
}

function roomStorageKey(userId: string) {
	return `olingo.memory-house.room.${userId}`
}

function loadSavedRoom(userId: string) {
	const stored = Number(localStorage.getItem(roomStorageKey(userId)))
	return Number.isInteger(stored) && stored >= 0 && stored < memoryRooms.length
		? stored
		: 0
}

function levelStep(level: string): 1 | 2 | 3 | 4 | 5 {
	if (level === 'A1') return 1
	if (level === 'A2') return 2
	if (level === 'B1') return 3
	if (level === 'B2') return 4
	return 5
}

function nextReviewLabel(state?: ExerciseState) {
	const status = memoryStatus(state)
	if (status === 'new') return 'New anchor'
	if (status === 'due') return 'Due now'
	if (status === 'strong') return 'Strong memory'
	const days = state?.intervalDays ?? 1
	return `Returns in ${days} day${days === 1 ? '' : 's'}`
}

export default function MemoryHouse() {
	const { userId } = useAuth()
	const { targetLevel, setTargetLevel } = useSettings()
	const [roomIndex, setRoomIndex] = useState(() => loadSavedRoom(userId))
	const [anchorIndex, setAnchorIndex] = useState(0)
	const [mode, setMode] = useState<PracticeMode>('route')
	const [reviewQueue, setReviewQueue] = useState<MemoryAnchorRef[]>([])
	const [reviewIndex, setReviewIndex] = useState(0)
	const [phase, setPhase] = useState<PracticePhase>('learn')
	const [states, setStates] = useState<Map<string, ExerciseState>>(new Map())
	const [ready, setReady] = useState(false)
	const [answer, setAnswer] = useState('')
	const [feedback, setFeedback] = useState<MemoryFeedback | null>(null)
	const [hintVisible, setHintVisible] = useState(false)
	const [checking, setChecking] = useState(false)
	const [recorderActive, setRecorderActive] = useState(false)
	const speechPlaybackRef = useRef<HTMLAudioElement | null>(null)
	const [retryVersion, setRetryVersion] = useState(0)
	const gradeInFlight = useRef(false)
	const [speechError, setSpeechError] = useState<string | null>(null)
	const [routeComplete, setRouteComplete] = useState(false)
	const [completionKind, setCompletionKind] = useState<PracticeMode>('route')
	const promptStartedAtRef = useRef(Date.now())

	const routeRef = useMemo<MemoryAnchorRef>(() => {
		const room = memoryRooms[roomIndex]
		return {
			roomIndex,
			anchorIndex,
			room,
			anchor: room.anchors[anchorIndex],
		}
	}, [anchorIndex, roomIndex])
	const current = mode === 'review' ? reviewQueue[reviewIndex] ?? routeRef : routeRef
	const currentId = memoryExerciseId(current.room.id, current.anchor.id)
	const speech = useSentenceSpeech({
		userId, exerciseId: ready ? currentId : undefined,
		resetKey: `${currentId}:${mode}:${targetLevel}:${retryVersion}`,
		onTranscript: setAnswer, hintsUsed: hintVisible ? 1 : 0, wordBankUsed: false,
	})
	const interactionBusy = checking || recorderActive || speech.loading
	useEffect(() => { if (speech.draft) setPhase('recall') }, [speech.draft?.attemptId])
	const currentState = states.get(currentId)
	const due = useMemo(() => dueMemoryAnchors(states), [states])
	const statusCounts = useMemo(() => {
		const counts = { new: 0, due: 0, learning: 0, strong: 0 }
		for (const ref of memoryAnchorRefs) {
			const state = states.get(memoryExerciseId(ref.room.id, ref.anchor.id))
			counts[memoryStatus(state)] += 1
		}
		return counts
	}, [states])
	const learnedCount = memoryAnchorRefs.length - statusCounts.new
	const roomPosition = atlasPosition(current.roomIndex)
	const backgroundPosition = `${roomPosition.column * 20}% ${
		roomPosition.row * (100 / 3)
	}%`

	useEffect(() => {
		let active = true
		async function loadStates() {
			setReady(false)
			const ids = new Set(
				memoryAnchorRefs.map(({ room, anchor }) =>
					memoryExerciseId(room.id, anchor.id)
				)
			)
			const existing = (await db.exerciseStates
				.where('userId')
				.equals(userId)
				.toArray()).filter((state) => ids.has(state.exerciseId))
			const existingIds = new Set(existing.map((state) => state.exerciseId))
			const missing = [...ids]
				.filter((id) => !existingIds.has(id))
				.map((id) => createExerciseState(userId, id))
			if (missing.length) await db.exerciseStates.bulkPut(missing)
			if (!active) return
			const all = [...existing, ...missing]
			setStates(new Map(all.map((state) => [state.exerciseId, state])))
			setReady(true)
		}
		void loadStates()
		return () => {
			active = false
		}
	}, [userId])

	useEffect(() => {
		localStorage.setItem(roomStorageKey(userId), String(roomIndex))
	}, [roomIndex, userId])

	useEffect(() => {
		if (!ready) return
		const state = states.get(currentId)
		setPhase(
			mode === 'review' || (state && state.correctCount + state.wrongCount > 0)
				? 'recall'
				: 'learn'
		)
		setAnswer('')
		setFeedback(null)
		setHintVisible(false)
		setSpeechError(null)
		promptStartedAtRef.current = Date.now()
	}, [currentId, mode, ready, targetLevel])

	function chooseRoom(index: number) {
		setMode('route')
		setRouteComplete(false)
		setRoomIndex(index)
		setAnchorIndex(0)
	}

	function moveRoom(change: number) {
		const next = Math.max(0, Math.min(memoryRooms.length - 1, current.roomIndex + change))
		chooseRoom(next)
	}

	function beginRecall() {
		setPhase('recall')
		setAnswer('')
		setFeedback(null)
		setHintVisible(false)
		promptStartedAtRef.current = Date.now()
	}

	function retryRecall() {
		setRetryVersion((value) => value + 1)
		setAnswer('')
		setFeedback(null)
		setHintVisible(false)
		setSpeechError(null)
		promptStartedAtRef.current = Date.now()
	}

	function startDueReview() {
		const queue = dueMemoryAnchors(states)
		if (!queue.length) return
		setReviewQueue(queue)
		setReviewIndex(0)
		setMode('review')
		setRouteComplete(false)
	}

	function leaveReview() {
		setMode('route')
		setReviewQueue([])
		setReviewIndex(0)
	}

	function advance() {
		if (mode === 'review') {
			if (reviewIndex + 1 < reviewQueue.length) {
				setReviewIndex((index) => index + 1)
				return
			}
			setMode('route')
			setReviewQueue([])
			setReviewIndex(0)
			setCompletionKind('review')
			setRouteComplete(true)
			return
		}

		if (anchorIndex === 0) {
			setAnchorIndex(1)
			return
		}
		if (roomIndex < memoryRooms.length - 1) {
			setRoomIndex((index) => index + 1)
			setAnchorIndex(0)
			return
		}
		setRouteComplete(true)
		setCompletionKind('route')
	}

	async function submitCandidate(
		candidate: string,
		voice?: SpeakingDraft
	) {
		if (!candidate.trim() || gradeInFlight.current || interactionBusy || !speech.ready || feedback) return
		gradeInFlight.current = true
		setChecking(true)
		setSpeechError(null)
		try {
			const exercise = memoryAnchorExercise(current.room, current.anchor, targetLevel)
			const state =
				states.get(exercise.id) ?? createExerciseState(userId, exercise.id)
			const item: SprintItem = {
				exercise,
				state,
				focusPhase: 'produce',
				reviewKind: state.correctCount + state.wrongCount > 0 ? 'scheduled-review' : 'new',
				skillId: `memory-house:${current.room.id}`,
				complexityStep: levelStep(targetLevel),
				cueMode: targetLevel === 'A1' || targetLevel === 'A2' ? 'english' : 'situation',
			}
			const msUsed = Math.max(500, Date.now() - promptStartedAtRef.current)
			const submission = await submitExerciseAnswer({
				userId,
				item,
				answer: candidate.trim(),
				targetLevel,
				sessionFocus: 'vocabulary',
				sessionDomain: current.room.domain,
				hintsUsed: Math.max(hintVisible ? 1 : 0, voice?.hintsUsed ?? 0),
				conceptHintsUsed: Math.max(hintVisible ? 1 : 0, voice?.hintsUsed ?? 0),
				wordBankUsed: false,
				spokenFirst: Boolean(voice),
				spoken: Boolean(voice),
				responseLatencyMs: voice ? undefined : msUsed,
				utteranceDurationMs: voice?.utteranceDurationMs ?? undefined,
				attemptId: voice?.attemptId,
				speechEvidence: voice ? {
					rawTranscript: voice.rawTranscript, confirmedTranscript: candidate.trim(),
					recordingDurationMs: voice.recordingDurationMs, speechOnsetMs: voice.responseLatencyMs,
					utteranceDurationMs: voice.utteranceDurationMs, timingBasis: voice.timingBasis,
				} : undefined,
				mode: 'memory-house',
				msUsed,
			})
			const memoryUpdated = submission.result.exerciseValid ? scheduleMemoryAnchorReview(
				submission.updated,
				submission.result.communicative
			) : submission.updated
			await db.exerciseStates.put(memoryUpdated)
			setStates((previous) => {
				const next = new Map(previous)
				next.set(exercise.id, memoryUpdated)
				return next
			})
			setAnswer(candidate.trim())
			setFeedback({
				result: submission.result,
				model: submission.result.correctedItalian || current.anchor.italian,
				meaning: current.anchor.english,
				msUsed,
			})
			if (voice) await speech.clearAfterAssessment().catch(() => setSpeechError('Your answer was assessed, but the saved recording could not be cleared.'))
		} catch (cause) {
			setSpeechError(cause instanceof AssessmentUnavailableError
				? 'Assessment is unavailable. Your answer is kept; retry when connected. Nothing has been marked.'
				: 'Could not finish assessing or saving this answer. Please keep this page open and try again.')
		} finally {
			gradeInFlight.current = false
			setChecking(false)
		}
	}

	function handleSubmit(event: FormEvent) {
		event.preventDefault()
		void submitCandidate(answer, speech.draft ?? undefined)
	}

	if (!ready) {
		return (
		<div className="memory-loading" role="status">
			<Loader2 className="spin" size={24} />
			Opening the Memory House...
		</div>
		)
	}

	return (
		<div className="memory-page">
			<header className="memory-heading">
				<div>
					<p className="eyebrow">Your fixed 24-stop recall route</p>
					<h1>The O’Connor Memory House</h1>
					<p>{current.room.zone} · {current.room.theme}</p>
				</div>
				<House size={36} aria-hidden="true" />
			</header>

			<section className="memory-dashboard" aria-label="Memory House progress">
				<div className="memory-progress-copy">
					<strong>{learnedCount} of {memoryAnchorRefs.length}</strong>
					<span>anchors visited</span>
				</div>
				<div className="memory-meter" aria-label={`${learnedCount} anchors visited`}>
					<span style={{ width: `${Math.round((learnedCount / memoryAnchorRefs.length) * 100)}%` }} />
				</div>
				<div className="memory-counts">
					<span><Clock3 size={15} /> {statusCounts.due} due</span>
					<span><Check size={15} /> {statusCounts.strong} strong</span>
				</div>
				<button
					className="btn btn-secondary"
					type="button"
					disabled={interactionBusy || !due.length || mode === 'review'}
					onClick={startDueReview}>
					<RotateCcw size={17} />
					Review due{due.length ? ` (${due.length})` : ''}
				</button>
			</section>

			<div className="memory-level-row">
				<span>Recall level</span>
				<div className="segmented-control memory-levels">
					{cefrLevels.map((level) => (
						<button
							className={targetLevel === level ? 'active' : ''}
							key={level}
							type="button"
							disabled={interactionBusy} onClick={() => setTargetLevel(level)}>
							{level}
						</button>
					))}
				</div>
			</div>

			<nav className="memory-route" aria-label="Rooms in the Memory House">
				{memoryRooms.map((room, index) => {
					const roomStates = room.anchors.map((anchor) =>
						states.get(memoryExerciseId(room.id, anchor.id))
					)
					const roomStrong = roomStates.every((state) => memoryStatus(state) === 'strong')
					const roomStarted = roomStates.some(
						(state) => state && state.correctCount + state.wrongCount > 0
					)
					return (
						<button
							className={`${mode === 'route' && roomIndex === index ? 'active' : ''} ${
								roomStrong ? 'strong' : roomStarted ? 'started' : ''
							}`}
							key={room.id}
							type="button"
							title={room.title}
							disabled={interactionBusy} onClick={() => chooseRoom(index)}>
							{index + 1}
						</button>
					)
				})}
			</nav>

			{mode === 'review' && (
				<div className="memory-review-banner">
					<span><Route size={17} /> Due review {reviewIndex + 1} of {reviewQueue.length}</span>
					<button className="btn btn-quiet" type="button" disabled={interactionBusy} onClick={leaveReview}>Return to route</button>
				</div>
			)}

			{routeComplete && (
				<section className="memory-complete">
					<Check size={22} />
					<div>
						<strong>{completionKind === 'review' ? 'Review complete' : 'You reached the end of the house'}</strong>
						<span>The anchors will return according to your recall, not on every visit.</span>
					</div>
					<button className="btn btn-secondary" type="button" disabled={interactionBusy} onClick={() => { setRouteComplete(false); chooseRoom(0) }}>
						Start at the driveway
					</button>
				</section>
			)}

			<div className="memory-workspace">
				<section className="memory-visual-panel" aria-label={`${current.room.title} visual locus`}>
					<div
						className="memory-room-image"
						role="img"
						aria-label={`Mnemonic view of ${current.room.title}`}
						style={{ backgroundPosition }}>
						<div className="memory-room-caption">
							<span>Room {current.roomIndex + 1} of {memoryRooms.length}</span>
							<strong>{current.room.title}</strong>
							<small>{current.room.italianTitle}</small>
						</div>
						{current.room.anchors.map((anchor, index) => (
							<button
								className={`memory-hotspot ${current.anchorIndex === index ? 'active' : ''}`}
								key={anchor.id}
								type="button"
								style={{ left: `${anchor.position.x}%`, top: `${anchor.position.y}%` }}
								title={anchor.label}
								disabled={interactionBusy} onClick={() => { setMode('route'); setRoomIndex(current.roomIndex); setAnchorIndex(index) }}>
								<MapPin size={18} />
								<span>{index + 1}</span>
							</button>
						))}
						<button
							className="memory-room-arrow previous"
							type="button"
							disabled={interactionBusy || current.roomIndex === 0}
							title="Previous room"
							onClick={() => moveRoom(-1)}>
							<ArrowLeft size={22} />
						</button>
						<button
							className="memory-room-arrow next"
							type="button"
							disabled={interactionBusy || current.roomIndex === memoryRooms.length - 1}
							title="Next room"
							onClick={() => moveRoom(1)}>
							<ArrowRight size={22} />
						</button>
					</div>
					<div className="memory-anchor-selector" aria-label="Anchors in this room">
						{current.room.anchors.map((anchor, index) => {
							const state = states.get(memoryExerciseId(current.room.id, anchor.id))
							return (
								<button
									className={current.anchorIndex === index ? 'active' : ''}
									key={anchor.id}
									type="button"
									disabled={interactionBusy} onClick={() => { setMode('route'); setRoomIndex(current.roomIndex); setAnchorIndex(index) }}>
									<span>{index + 1}</span>
									<strong>{anchor.label}</strong>
									<small>{nextReviewLabel(state)}</small>
								</button>
							)
						})}
					</div>
				</section>

				<section className="memory-practice-panel">
					<div className="memory-practice-meta">
						<span>Anchor {current.anchorIndex + 1} of 2</span>
						<span className={`memory-status ${memoryStatus(currentState)}`}>{nextReviewLabel(currentState)}</span>
					</div>

					{phase === 'learn' ? (
						<div className="memory-learn">
							<p className="eyebrow">Place this phrase in the room</p>
							<h2>{current.anchor.italian}</h2>
							<p>{current.anchor.english}</p>
							<div className="memory-actions">
								<button className="btn btn-secondary" type="button" onClick={() => speak(current.anchor.italian)}>
									<Volume2 size={18} /> Hear Italian
								</button>
								<button className="btn btn-primary" type="button" onClick={beginRecall}>
									<BookOpen size={18} /> Hide and recall
								</button>
							</div>
						</div>
					) : (
						<form className="memory-recall" onSubmit={handleSubmit}>
							<p className="eyebrow">Say this in Italian</p>
							<h2>{memoryCueForLevel(current.anchor, targetLevel)}</h2>
							{targetLevel !== 'A1' && targetLevel !== 'A2' && (
								<span className="memory-cue-kind">Situation cue · no word-for-word translation</span>
							)}
							<SentenceVoiceRecorder
								key={`${currentId}:${mode}:${targetLevel}:${retryVersion}`}
								busy={speech.loading || checking}
								disabled={Boolean(feedback) || checking || !speech.ready}
								onActiveChange={(active) => { if (active) speechPlaybackRef.current?.pause(); setRecorderActive(active) }}
								onRecording={speech.recording}
							/>
							{speech.draft && <div className="speech-review">
								<strong>Review what you said</strong>
								{speech.audioUrl && <audio ref={speechPlaybackRef} controls={!recorderActive} src={speech.audioUrl} aria-label="Your recorded answer" />}
								<p>Recording: {(speech.draft.recordingDurationMs / 1000).toFixed(1)} s. Check the transcript below before assessment. Timing starts with recording, not the prompt.</p>
								{!feedback && <div className="memory-actions">
									<button className="btn btn-secondary" type="button" disabled={interactionBusy} onClick={() => void speech.transcribe()}>Retry transcription</button>
									<button className="btn btn-quiet" type="button" disabled={interactionBusy} onClick={() => void speech.discard()}>Discard recording</button>
								</div>}
							</div>}
							{(speechError || speech.error) && <p className="field-error" role="alert">{speechError || speech.error}</p>}
							<textarea
								aria-label={speech.draft ? 'Confirm your Italian transcript' : 'Italian answer'}
								disabled={Boolean(feedback) || interactionBusy || !speech.ready}
								placeholder={speech.draft ? 'Correct any misheard words here…' : 'Type your Italian answer…'}
								rows={4}
								value={answer}
								onChange={(event) => speech.editTranscript(event.target.value)}
							/>
							{hintVisible && (
								<div className="memory-hint">
									<Lightbulb size={17} />
									<span><strong>{current.anchor.english}</strong> · starts “{current.anchor.italian.split(/\s+/).slice(0, 2).join(' ')}…”</span>
								</div>
							)}

							{feedback && (
								<div className={
									feedback.result.accepted
										? 'feedback feedback-good'
										: feedback.result.communicative
										? 'feedback feedback-communicative'
										: 'feedback feedback-repair'
								}>
									<strong>{feedback.result.message}</strong>
									<span className="feedback-note">{feedback.result.shortFeedback}</span>
									<div className="feedback-model">
										<p>{feedback.model}</p>
										<span><b>Meaning:</b> {feedback.meaning}</span>
									</div>
									<button className="btn btn-secondary" type="button" onClick={() => speak(feedback.model)}>
										<Volume2 size={18} /> Hear Italian
									</button>
								</div>
							)}

							<div className="memory-actions">
								{!feedback ? (
									<>
										<button className="btn btn-secondary" type="button" disabled={hintVisible || interactionBusy || !speech.ready} onClick={() => setHintVisible(true)}>
											<Lightbulb size={18} /> Hint
										</button>
										<button className="btn btn-primary" type="submit" disabled={!answer.trim() || interactionBusy || !speech.ready}>
											{checking ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
											{speech.draft ? 'Confirm transcript and assess' : 'Check recall'}
										</button>
									</>
								) : !feedback.result.communicative ? (
									<button className="btn btn-primary" type="button" onClick={retryRecall}>
										<RotateCcw size={18} /> Try once more
									</button>
								) : (
									<button className="btn btn-primary" type="button" onClick={advance}>
										Next anchor <ArrowRight size={18} />
									</button>
								)}
							</div>
						</form>
					)}
				</section>
			</div>
		</div>
	)
}

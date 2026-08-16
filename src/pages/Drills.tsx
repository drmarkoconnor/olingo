import { useEffect, useMemo, useRef, useState } from 'react'
import {
	ArrowLeft,
	ArrowRight,
	BookOpenCheck,
	Check,
	ChevronRight,
	Clock3,
	Dumbbell,
	Ear,
	Lightbulb,
	Loader2,
	Mic2,
	RotateCcw,
	Sparkles,
	Target,
	X,
} from 'lucide-react'
import SentenceVoiceRecorder, {
	type VoiceRecording,
} from '@/components/SentenceVoiceRecorder'
import { cefrLevels, type CefrLevel } from '@/learning/content'
import {
	drillFamilies,
	drillFocusAvailable,
	drillFocuses,
	drillStageLabels,
	getDrillFamily,
	getDrillFocus,
	getDrillStagePlan,
	type DrillFamilyId,
	type DrillFocus,
} from '@/learning/drill-catalogue'
import {
	buildGeneratedDrillRun,
	buildLocalDrillRun,
	drillRunIsValid,
	drillStageProgress,
	type DrillPrompt,
	type DrillRun,
	type GeneratedDrillPayload,
} from '@/learning/verb-drills'
import type { EvaluationResult } from '@/learning/evaluator'
import { submitExerciseAnswer, type SprintItem } from '@/learning/progress'
import { createExerciseState } from '@/learning/scheduler'
import type { SessionFocus } from '@/learning/session-focus'
import { apiFetch, friendlyApiError } from '@/lib/api'
import { speak } from '@/lib/tts'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'
import { db } from '@/storage/db'

type DrillResult = {
	promptId: string
	accepted: boolean
	communicative: boolean
	msUsed: number
	hintsUsed: number
	spoken: boolean
}

type Feedback = {
	result: EvaluationResult
	model: string
	meaning: string
}

type SavedDrill = {
	run: DrillRun
	index: number
	results: DrillResult[]
}

const countChoices = [20, 25, 30]

function storageKey(userId: string) {
	return `olingo.drill.active.${userId}`
}

function loadSavedDrill(userId: string): SavedDrill | null {
	try {
		const raw = localStorage.getItem(storageKey(userId))
		if (!raw) return null
		const saved = JSON.parse(raw) as SavedDrill
		if (!saved.run || !drillRunIsValid(saved.run)) return null
		return {
			run: saved.run,
			index: Math.max(0, Math.min(saved.index ?? 0, saved.run.prompts.length)),
			results: Array.isArray(saved.results) ? saved.results : [],
		}
	} catch {
		return null
	}
}

function focusForDrill(focus: DrillFocus): SessionFocus {
	if (focus === 'forms' || focus === 'conversation') return 'fluency'
	if (focus === 'polarity') return 'questions'
	if (focus === 'pronouns') return 'pronouns'
	if (focus === 'time-shifts') return 'past-events'
	return 'adaptive'
}

function formatDuration(ms: number) {
	const seconds = Math.max(0, Math.round(ms / 1000))
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds % 60
	return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`
}

export default function Drills() {
	const { userId } = useAuth()
	const { targetLevel, setTargetLevel } = useSettings()
	const saved = useMemo(() => loadSavedDrill(userId), [userId])
	const [familyId, setFamilyId] = useState<DrillFamilyId>(
		saved?.run.familyId ?? 'modal-engine'
	)
	const [focus, setFocus] = useState<DrillFocus>(saved?.run.focus ?? 'guided')
	const [targetCount, setTargetCount] = useState(saved?.run.targetCount ?? 20)
	const [run, setRun] = useState<DrillRun | null>(saved?.run ?? null)
	const [index, setIndex] = useState(saved?.index ?? 0)
	const [results, setResults] = useState<DrillResult[]>(saved?.results ?? [])
	const [answer, setAnswer] = useState('')
	const [feedback, setFeedback] = useState<Feedback | null>(null)
	const [hintsRevealed, setHintsRevealed] = useState(0)
	const [modelVisible, setModelVisible] = useState(
		(saved?.run.prompts[saved.index]?.stage ?? '') === 'meet'
	)
	const [checking, setChecking] = useState(false)
	const [speechLoading, setSpeechLoading] = useState(false)
	const [speechError, setSpeechError] = useState<string | null>(null)
	const [prefetchedRun, setPrefetchedRun] = useState<DrillRun | null>(null)
	const [prefetching, setPrefetching] = useState(false)
	const promptStartedAtRef = useRef(Date.now())
	const prefetchRequestRef = useRef('')

	const family = getDrillFamily(familyId)
	const current = run?.prompts[index] ?? null
	const complete = Boolean(run && index >= run.prompts.length)
	const availableFocuses = drillFocuses.filter((item) =>
		drillFocusAvailable(family, item.id, targetLevel)
	)
	const stageProgress = run ? drillStageProgress(run.prompts, index) : []
	const activeMs = results.reduce((sum, item) => sum + item.msUsed, 0)
	const communicativeCount = results.filter((item) => item.communicative).length
	const accurateCount = results.filter((item) => item.accepted).length
	const spokenCount = results.filter((item) => item.spoken).length
	const stagePlan = getDrillStagePlan(targetLevel, focus, targetCount)
	const stageCounts = stagePlan.reduce<Record<string, number>>((counts, stage) => {
		counts[stage] = (counts[stage] ?? 0) + 1
		return counts
	}, {})

	useEffect(() => {
		if (!run) {
			localStorage.removeItem(storageKey(userId))
			return
		}
		localStorage.setItem(
			storageKey(userId),
			JSON.stringify({ run, index, results } satisfies SavedDrill)
		)
	}, [index, results, run, userId])

	function resetPrompt(prompt: DrillPrompt | null) {
		setAnswer('')
		setFeedback(null)
		setHintsRevealed(0)
		setSpeechError(null)
		setModelVisible(prompt?.stage === 'meet')
		promptStartedAtRef.current = Date.now()
	}

	async function prefetchNext(activeRun: DrillRun) {
		const requestId = `${activeRun.id}:next`
		if (prefetchRequestRef.current === requestId) return
		prefetchRequestRef.current = requestId
		setPrefetching(true)
		try {
			const response = await apiFetch('/api/generate-drill-ladder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					familyId: activeRun.familyId,
					level: activeRun.level,
					focus: activeRun.focus,
					targetCount: activeRun.targetCount,
					stagePlan: getDrillStagePlan(
						activeRun.level,
						activeRun.focus,
						activeRun.targetCount
					),
					avoidItalian: activeRun.prompts.map(
						(prompt) => prompt.exercise.targetItalian
					),
					avoidEnglish: activeRun.prompts.map(
						(prompt) => prompt.exercise.promptEnglish
					),
				}),
			})
			if (!response.ok) return
			const payload = (await response.json()) as {
				packId?: string
				provider?: string
				prompts?: GeneratedDrillPayload[]
			}
			if (
				payload.provider !== 'openai' ||
				!payload.packId ||
				!Array.isArray(payload.prompts)
			) {
				return
			}
			const next = buildGeneratedDrillRun({
				familyId: activeRun.familyId,
				focus: activeRun.focus,
				level: activeRun.level,
				targetCount: activeRun.targetCount,
				packId: payload.packId,
				prompts: payload.prompts,
			})
			if (drillRunIsValid(next)) setPrefetchedRun(next)
		} catch {
			// The curated ladder remains available when generation is offline.
		} finally {
			setPrefetching(false)
		}
	}

	function begin(nextRun?: DrillRun) {
		const selectedRun =
			nextRun ??
			buildLocalDrillRun({
				familyId,
				focus,
				level: targetLevel,
				targetCount,
				seed: Date.now(),
			})
		setRun(selectedRun)
		setFamilyId(selectedRun.familyId)
		setFocus(selectedRun.focus)
		setTargetCount(selectedRun.targetCount)
		setResults([])
		setIndex(0)
		setPrefetchedRun(null)
		prefetchRequestRef.current = ''
		resetPrompt(selectedRun.prompts[0] ?? null)
		window.scrollTo({ top: 0, behavior: 'auto' })
		void prefetchNext(selectedRun)
	}

	function chooseFamily(nextFamilyId: DrillFamilyId) {
		const nextFamily = getDrillFamily(nextFamilyId)
		setFamilyId(nextFamilyId)
		if (!drillFocusAvailable(nextFamily, focus, targetLevel)) setFocus('guided')
	}

	function chooseLevel(level: CefrLevel) {
		setTargetLevel(level)
		if (!drillFocusAvailable(family, focus, level)) setFocus('guided')
	}

	async function submitCandidate(
		candidate: string,
		voice?: { responseLatencyMs: number; utteranceDurationMs: number }
	) {
		if (!current || !candidate.trim() || checking || feedback) return
		setChecking(true)
		setSpeechError(null)
		const msUsed = Math.max(500, Date.now() - promptStartedAtRef.current)
		try {
			const state =
				(await db.exerciseStates.get([userId, current.exercise.id])) ??
				createExerciseState(userId, current.exercise.id)
			const item: SprintItem = {
				exercise: current.exercise,
				state,
				focusPhase: current.exercise.phase,
				reviewKind: 'new',
				skillId: `drill:${current.familyId}:${current.focus}`,
				complexityStep: current.complexityStep,
				cueMode: current.cueMode,
			}
			const submission = await submitExerciseAnswer({
				userId,
				item,
				answer: candidate.trim(),
				targetLevel: run?.level ?? targetLevel,
				sessionFocus: focusForDrill(current.focus),
				sessionDomain: current.exercise.vocabDomain ?? 'mixed',
				hintsUsed: hintsRevealed,
				conceptHintsUsed: hintsRevealed,
				spokenFirst: Boolean(voice),
				spoken: Boolean(voice),
				responseLatencyMs: voice?.responseLatencyMs ?? msUsed,
				utteranceDurationMs: voice?.utteranceDurationMs,
				mode: 'verb-drill',
				msUsed,
			})
			setAnswer(candidate.trim())
			setFeedback({
				result: submission.result,
				model: current.exercise.targetItalian,
				meaning: current.exercise.promptEnglish,
			})
			setResults((items) => [
				...items,
				{
					promptId: current.id,
					accepted: submission.result.accepted,
					communicative: submission.result.communicative,
					msUsed,
					hintsUsed: hintsRevealed,
					spoken: Boolean(voice),
				},
			])
		} finally {
			setChecking(false)
		}
	}

	async function handleRecording(recording: VoiceRecording) {
		if (!current || feedback || speechLoading) return
		setSpeechLoading(true)
		setSpeechError(null)
		try {
			const form = new FormData()
			form.append('audio', recording.audio, 'olingo-drill.webm')
			form.append(
				'context',
				[
					current.exercise.vocabDomain,
					current.exercise.communicativeFunction,
					current.exercise.phraseFamily,
				]
					.filter(Boolean)
					.join(', ')
			)
			form.append('skillId', `drill:${current.familyId}:${current.focus}`)
			form.append('responseLatencyMs', String(recording.responseLatencyMs))
			form.append('utteranceDurationMs', String(recording.utteranceDurationMs))
			const response = await apiFetch('/api/transcribe-speech', {
				method: 'POST',
				body: form,
			})
			const data = (await response.json().catch(() => null)) as {
				transcript?: string
				error?: string
			} | null
			if (!response.ok || !data?.transcript) {
				throw new Error(
					friendlyApiError(
						response.status,
						data?.error,
						'Speech could not be checked. Type the sentence instead.'
					)
				)
			}
			await submitCandidate(data.transcript, {
				responseLatencyMs: recording.responseLatencyMs,
				utteranceDurationMs: recording.utteranceDurationMs,
			})
		} catch (error) {
			setSpeechError(
				error instanceof Error
					? error.message
					: 'Speech could not be checked. Type the sentence instead.'
			)
		} finally {
			setSpeechLoading(false)
		}
	}

	function nextPrompt() {
		if (!run) return
		const nextIndex = index + 1
		setIndex(nextIndex)
		resetPrompt(run.prompts[nextIndex] ?? null)
	}

	function leaveRun() {
		setRun(null)
		setIndex(0)
		setResults([])
		setPrefetchedRun(null)
		setFeedback(null)
		localStorage.removeItem(storageKey(userId))
		window.scrollTo({ top: 0, behavior: 'auto' })
	}

	function startAnother() {
		const next =
			prefetchedRun ??
			buildLocalDrillRun({
				familyId: run?.familyId ?? familyId,
				focus: run?.focus ?? focus,
				level: run?.level ?? targetLevel,
				targetCount: run?.targetCount ?? targetCount,
				seed: Date.now() + 7919,
			})
		begin(next)
	}

	if (!run) {
		return (
			<div className="page-stack drills-page">
				<header className="page-heading drills-heading">
					<div>
						<p className="eyebrow">Unlimited focused practice</p>
						<h1>Verb family drills</h1>
						<p>Choose one speaking engine and finish a complete 20-30 step ladder.</p>
					</div>
					<Dumbbell size={34} aria-hidden="true" />
				</header>

				<section className="drill-setup-section" aria-labelledby="drill-level-heading">
					<div className="drill-setup-heading">
						<span>1</span>
						<div>
							<h2 id="drill-level-heading">Level</h2>
							<p>Higher levels change the operation and independence, not the sentence length.</p>
						</div>
					</div>
					<div className="segmented-control drill-levels">
						{cefrLevels.map((level) => (
							<button
								className={targetLevel === level ? 'active' : ''}
								key={level}
								type="button"
								onClick={() => chooseLevel(level)}>
								{level}
							</button>
						))}
					</div>
				</section>

				<section className="drill-setup-section" aria-labelledby="drill-family-heading">
					<div className="drill-setup-heading">
						<span>2</span>
						<div>
							<h2 id="drill-family-heading">Verb family</h2>
							<p>Anchor one useful pattern, then distinguish its close neighbours.</p>
						</div>
					</div>
					<div className="drill-family-grid">
						{drillFamilies.map((item) => (
							<button
								className={familyId === item.id ? 'drill-family active' : 'drill-family'}
								key={item.id}
								type="button"
								onClick={() => chooseFamily(item.id)}>
								<span>{item.shortLabel}</span>
								<strong>{item.anchors.slice(0, 4).join(' · ')}</strong>
								<ChevronRight size={18} />
							</button>
						))}
					</div>
				</section>

				<section className="drill-setup-section" aria-labelledby="drill-focus-heading">
					<div className="drill-setup-heading">
						<span>3</span>
						<div>
							<h2 id="drill-focus-heading">Challenge</h2>
							<p>Choose the operation you want to make automatic.</p>
						</div>
					</div>
					<div className="drill-focus-grid">
						{availableFocuses.map((item) => (
							<button
								className={focus === item.id ? 'drill-focus active' : 'drill-focus'}
								key={item.id}
								type="button"
								onClick={() => setFocus(item.id)}>
								<strong>{item.label}</strong>
								<span>{item.description}</span>
							</button>
						))}
					</div>
				</section>

				<section className="drill-setup-section" aria-labelledby="drill-length-heading">
					<div className="drill-setup-heading">
						<span>4</span>
						<div>
							<h2 id="drill-length-heading">Run length</h2>
							<p>The run has a finish; another variation is always available afterwards.</p>
						</div>
					</div>
					<div className="segmented-control drill-counts">
						{countChoices.map((count) => (
							<button
								className={targetCount === count ? 'active' : ''}
								key={count}
								type="button"
								onClick={() => setTargetCount(count)}>
								{count}
							</button>
						))}
					</div>
				</section>

				<section className="drill-contract">
					<div>
						<p className="eyebrow">Ready</p>
						<h2>{family.shortLabel}</h2>
						<p>{getDrillFocus(focus).label} · {targetLevel} · {targetCount} prompts</p>
					</div>
					<div className="drill-stage-preview" aria-label="Run stages">
						{Object.entries(stageCounts).map(([stage, count]) => (
							<span key={stage}>
								<strong>{count}</strong>
								{drillStageLabels[stage as keyof typeof drillStageLabels]}
							</span>
						))}
					</div>
					<button className="btn btn-primary drill-start" type="button" onClick={() => begin()}>
						<ArrowRight size={19} />
						Start drill
					</button>
				</section>
			</div>
		)
	}

	if (complete) {
		const communicativeRate = results.length
			? Math.round((communicativeCount / results.length) * 100)
			: 0
		return (
			<div className="page-stack drills-page">
				<section className="drill-complete">
					<div className="drill-complete-mark"><Check size={34} /></div>
					<p className="eyebrow">Drill complete</p>
					<h1>{getDrillFamily(run.familyId).shortLabel}</h1>
					<p>You completed the full {run.prompts.length}-step ladder.</p>
					<div className="drill-summary-grid">
						<div><Target size={20} /><strong>{communicativeRate}%</strong><span>communicative</span></div>
						<div><Check size={20} /><strong>{accurateCount}</strong><span>accurate</span></div>
						<div><Mic2 size={20} /><strong>{spokenCount}</strong><span>spoken</span></div>
						<div><Clock3 size={20} /><strong>{formatDuration(activeMs)}</strong><span>answering time</span></div>
					</div>
					{results.some((item) => !item.accepted) && (
						<div className="drill-repair-note">
							<RotateCcw size={19} />
							<span>Imperfect answers have been scheduled for varied repair.</span>
						</div>
					)}
					<div className="drill-complete-actions">
						<button className="btn btn-secondary" type="button" onClick={leaveRun}>
							<ArrowLeft size={18} />
							Choose another
						</button>
						<button className="btn btn-primary" type="button" onClick={startAnother}>
							{prefetchedRun ? <Sparkles size={18} /> : <RotateCcw size={18} />}
							New variation
						</button>
					</div>
					{prefetching && (
						<span className="drill-generation-status"><Loader2 className="spin" size={15} /> Preparing fresh examples</span>
					)}
				</section>
			</div>
		)
	}

	if (!current) return null
	const promptNumber = index + 1
	const visibleHints = current.exercise.hints.slice(0, hintsRevealed)
	const needsModelFade = current.stage === 'meet' && modelVisible

	return (
		<div className="drills-workspace">
			<aside className="drill-rail">
				<button className="drill-back" type="button" onClick={leaveRun}>
					<ArrowLeft size={17} /> Change drill
				</button>
				<div className="drill-rail-heading">
					<p className="eyebrow">{run.level} · {getDrillFocus(run.focus).shortLabel}</p>
					<h2>{getDrillFamily(run.familyId).shortLabel}</h2>
					<span>{promptNumber} of {run.prompts.length}</span>
				</div>
				<div className="drill-stage-rail">
					{stageProgress.map((item) => (
						<div
							className={item.active ? 'drill-stage active' : item.completed === item.total ? 'drill-stage complete' : 'drill-stage'}
							key={item.stage}>
							<span>{item.completed === item.total ? <Check size={14} /> : item.active ? <Target size={14} /> : null}</span>
							<div><strong>{item.label}</strong><small>{item.completed}/{item.total}</small></div>
						</div>
					))}
				</div>
				<div className="drill-rail-meta">
					<span><Clock3 size={15} /> {formatDuration(activeMs)}</span>
					<span><Target size={15} /> {communicativeCount} usable</span>
				</div>
			</aside>

			<section className="drill-task-column">
				<header className="drill-task-header">
					<div>
						<p className="eyebrow">{current.stageLabel}</p>
						<h1>{current.instruction}</h1>
					</div>
					<strong>{promptNumber}/{run.prompts.length}</strong>
				</header>

				<div className="drill-progress-bar" aria-label={`${promptNumber} of ${run.prompts.length}`}>
					<span style={{ width: `${(index / run.prompts.length) * 100}%` }} />
				</div>

				{current.exercise.npcLine && (
					<div className="drill-speaker-line">
						<span>Italian speaker</span>
						<strong>{current.exercise.npcLine}</strong>
						<button type="button" title="Hear the Italian speaker" onClick={() => void speak(current.exercise.npcLine ?? '')}>
							<Ear size={18} />
						</button>
					</div>
				)}

				<div className="drill-prompt-card">
					<div className="drill-cue-label">
						<BookOpenCheck size={18} />
						<span>{needsModelFade ? 'Meet the pattern' : 'Say this in Italian'}</span>
					</div>
					<h2>{current.exercise.promptEnglish}</h2>

					{needsModelFade ? (
						<div className="drill-model-introduction">
							<strong>{current.exercise.targetItalian}</strong>
							<div>
								<button className="btn btn-secondary" type="button" onClick={() => void speak(current.exercise.targetItalian)}>
									<Ear size={18} /> Hear Italian
								</button>
								<button
									className="btn btn-primary"
									type="button"
									onClick={() => {
										setModelVisible(false)
										promptStartedAtRef.current = Date.now()
									}}>
									I said it · test me
									<ArrowRight size={18} />
								</button>
							</div>
						</div>
					) : (
						<>
							<div className="drill-speaking-row">
								<div><Mic2 size={18} /><span>Answer aloud first</span></div>
								<SentenceVoiceRecorder
									busy={speechLoading}
									disabled={checking || Boolean(feedback)}
									promptStartedAt={promptStartedAtRef.current}
									onRecording={handleRecording}
								/>
							</div>
							{speechError && <p className="field-error">{speechError}</p>}
							<textarea
								aria-label="Italian answer"
								disabled={Boolean(feedback)}
								placeholder="Type the Italian you meant..."
								rows={4}
								value={answer}
								onChange={(event) => setAnswer(event.target.value)}
							/>
							{visibleHints.length > 0 && (
								<div className="drill-hints">
									{visibleHints.map((hint) => <span key={hint}><Lightbulb size={15} /> {hint}</span>)}
								</div>
							)}

							{feedback && (
								<div className={feedback.result.communicative ? 'drill-feedback success' : 'drill-feedback repair'}>
									<div>{feedback.result.communicative ? <Check size={20} /> : <X size={20} />}</div>
									<section>
										<strong>{feedback.result.message}</strong>
										<p>{feedback.result.shortFeedback}</p>
										<b>{feedback.model}</b>
										<span>Meaning: {feedback.meaning}</span>
										<button className="btn btn-secondary" type="button" onClick={() => void speak(feedback.model)}>
											<Ear size={17} /> Hear Italian
										</button>
									</section>
								</div>
							)}

							<div className="drill-task-actions">
								<button
									className="btn btn-secondary"
									type="button"
									disabled={Boolean(feedback) || hintsRevealed >= current.exercise.hints.length}
									onClick={() => setHintsRevealed((value) => value + 1)}>
									<Lightbulb size={18} /> Hint
								</button>
								{feedback ? (
									<button className="btn btn-primary" type="button" onClick={nextPrompt}>
										Next <ArrowRight size={18} />
									</button>
								) : (
									<button
										className="btn btn-primary"
										type="button"
										disabled={!answer.trim() || checking || speechLoading}
										onClick={() => void submitCandidate(answer)}>
										{checking ? <Loader2 className="spin" size={18} /> : <Target size={18} />}
										Check
									</button>
								)}
							</div>
						</>
					)}
				</div>
			</section>
		</div>
	)
}

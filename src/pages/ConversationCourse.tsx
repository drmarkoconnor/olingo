import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SentenceVoiceRecorder from '@/components/SentenceVoiceRecorder'
import ConversationGarden from '@/components/ConversationGarden'
import { useLearningHistory } from '@/components/LearningHistory'
import { RecapDetails } from '@/components/SessionRecap'
import { useSentenceSpeech } from '@/hooks/useSentenceSpeech'
import { courseLessons, courseLevels, courseStrands, type CourseLesson } from '@/learning/conversation-course'
import { lessonProgress, levelReadiness, recommendLesson, type CourseAttempt } from '@/learning/course-progress'
import { conversationRecap, conversationLevelAdvice, type ConversationRecap } from '@/learning/conversation-guidance'
import { saveConversationDocument, exportConversationHistory } from '@/learning/conversation-sync'
import { patchLearnerProfile } from '@/learning/learner-profile'
import { generateConversation, generatedCourseTurn, isConversationEpisode } from '@/learning/conversation-client'
import type { GeneratedConversationEpisode, GenerateConversationRequest, ConversationSource, ConversationLine } from '@/learning/generated-conversation'
import { courseExercise } from '@/learning/course-exercises'
import type { CefrLevel } from '@/learning/content'
import type { EvaluationResult } from '@/learning/evaluator'
import { submitExerciseAnswer } from '@/learning/progress'
import { createExerciseState } from '@/learning/scheduler'
import { speak, stopCurrentAudio } from '@/lib/tts'
import { db } from '@/storage/db'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'

type Run = { id: string; lessonId: string; variant: 'base' | 'transfer'; turn: number; episodeId?: string; title?: string; completed?: boolean }
function validRun(value: unknown): value is Run {
 if (!value || typeof value !== 'object') return false
 const run = value as Run
 return typeof run.id === 'string' && courseLessons.some(item => item.id === run.lessonId) && ['base', 'transfer'].includes(run.variant) && Number.isInteger(run.turn) && run.turn >= 0 && run.turn <= 3 && (run.episodeId === undefined || typeof run.episodeId === 'string')
}
const runKey = (userId: string) => `olingo.conversation-run.${userId}`

export default function ConversationCourse() {
 const { userId } = useAuth()
 return <CourseForLearner key={userId} userId={userId} />
}
function CourseForLearner({ userId }: { userId: string }) {
 const history = useLearningHistory()
 const { attempts, documents, ready } = history
 const { targetLevel, setTargetLevel } = useSettings()
 const location = useLocation()
 const [run, setRun] = useState<Run | null>(null)
 const [episode, setEpisode] = useState<GeneratedConversationEpisode | undefined>()
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [generationFailed, setGenerationFailed] = useState(false)
 const [initialRecap, setInitialRecap] = useState<ConversationRecap | null | undefined>()
 const [recapDismissed, setRecapDismissed] = useState(false)
 const [levelAcknowledged, setLevelAcknowledged] = useState<CefrLevel | null>(null)
 const [interests, setInterests] = useState('')
 const [sourceLabel, setSourceLabel] = useState('')
 const [sourceUrl, setSourceUrl] = useState('')
 const [sourceText, setSourceText] = useState('')
 const generationLock = useRef(false)
 const generationRequest = useRef<{ key: string; requestId: string } | null>(null)
 const initialised = useRef(false)
 const runTitles = Object.fromEntries(documents.filter(item => item.kind === 'run' && typeof item.payload.title === 'string').map(item => [item.id, item.payload.title as string]))
 const savedRuns = documents.filter(item => item.kind === 'run' && validRun(item.payload)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
 const unfinished = savedRuns.find(item => validRun(item.payload) && !item.payload.completed && item.payload.turn < 3)?.payload as Run | undefined
 useEffect(() => {
  if (!ready || initialised.current) return
  initialised.current = true
  setInitialRecap(conversationRecap(attempts, { runTitles }))
  const profile = documents.find(item => item.kind === 'profile' && item.id === 'learner')
  if (Array.isArray(profile?.payload.interests)) setInterests(profile.payload.interests.filter(item => typeof item === 'string').join(', '))
  try {
   const old = JSON.parse(localStorage.getItem(runKey(userId)) || 'null')
   if (validRun(old) && !savedRuns.some(item => item.id === old.id)) void saveConversationDocument(userId, 'run', old.id, { ...old }).then(() => localStorage.removeItem(runKey(userId))).catch(() => undefined)
  } catch { /* A malformed legacy checkpoint is not learning evidence. */ }
 }, [ready, attempts, documents, userId])
 useEffect(() => {
  const source = (location.state as { conversationSource?: ConversationSource } | null)?.conversationSource
  if (source && typeof source.label === 'string' && typeof source.excerpt === 'string') {
   setSourceLabel(source.label); setSourceUrl(source.url || ''); setSourceText(source.excerpt.slice(0, 8000))
  }
 }, [location.state])
 const recommendation = recommendLesson(targetLevel, attempts)
 const readiness = levelReadiness(targetLevel, attempts)
 const advice = conversationLevelAdvice(targetLevel, attempts)
 const lesson = courseLessons.find(item => item.id === run?.lessonId)
 const level = courseLevels.find(item => item.level === targetLevel)!
 const topicList = () => interests.split(',').map(item => item.trim().slice(0, 60)).filter(Boolean).slice(0, 8)
 const isCurrentUser = () => useAuth.getState().userId === userId && useAuth.getState().authenticated
 async function rememberPreferences(nextLevel?: CefrLevel) {
  await patchLearnerProfile(userId, { ...(nextLevel ? { targetLevel: nextLevel } : {}), interests: topicList() }, isCurrentUser)
 }
 async function chooseLevel(nextLevel: CefrLevel) {
  if (busy) return
  setError('')
  try { const saved = await patchLearnerProfile(userId, { targetLevel: nextLevel }, isCurrentUser); if (saved && isCurrentUser()) { setTargetLevel(nextLevel); setLevelAcknowledged(null) } }
  catch { setError('Your level preference could not be saved. Please retry.') }
 }
 async function saveRun(next: Run) {
  await saveConversationDocument(userId, 'run', next.id, { ...next })
  setRun(next)
 }
 async function startAuthored(item: CourseLesson, variant: Run['variant'], repairTurnId?: string) {
  if (generationLock.current) return
  setBusy(true); setError('')
  try {
   setEpisode(undefined)
   await saveRun({ id: crypto.randomUUID(), lessonId: item.id, variant, turn: Math.max(0, item.turns.findIndex(turn => turn.id === repairTurnId)), title: item.title })
   setRecapDismissed(true); setGenerationFailed(false)
  } catch { setError('The episode could not be saved. Please retry.') }
  finally { setBusy(false) }
 }
 async function startFresh(item: CourseLesson) {
  if (generationLock.current) return
  generationLock.current = true; setBusy(true); setError('')
  try {
   let source: ConversationSource | undefined
   if (sourceText.trim()) {
    if (!sourceLabel.trim()) throw new Error('Give your extract a short title or source label first.')
    source = { label: sourceLabel.trim(), excerpt: sourceText.trim(), ...(sourceUrl.trim() ? { url: sourceUrl.trim() } : {}) }
   }
   const request: GenerateConversationRequest = { mode: 'episode', lessonId: item.id, interests: topicList(), source,
    avoidSituations: documents.filter(doc => doc.kind === 'episode').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).slice(-20).map(doc => String(doc.payload.situationKey || doc.payload.title || '')).filter(Boolean) }
   const key = JSON.stringify(request)
   if (generationRequest.current?.key !== key) generationRequest.current = { key, requestId: crypto.randomUUID() }
   const response = await generateConversation({ ...request, requestId: generationRequest.current.requestId }, userId)
   if (!('episode' in response)) throw new Error('No episode was returned.')
   await saveConversationDocument(userId, 'episode', response.episode.id, { ...response.episode })
   const next: Run = { id: crypto.randomUUID(), lessonId: item.id, episodeId: response.episode.id, variant: 'transfer', turn: 0, title: response.episode.title }
   await saveRun(next); setEpisode(response.episode)
   await rememberPreferences(item.level)
   generationRequest.current = null; setGenerationFailed(false); setRecapDismissed(true)
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Fresh conversation is unavailable. Retry or choose an authored episode.') }
  finally { generationLock.current = false; setBusy(false) }
 }
 async function resume(saved: Run) {
  setError('')
  const savedEpisode = saved.episodeId ? documents.find(item => item.kind === 'episode' && item.id === saved.episodeId)?.payload : undefined
  if (saved.episodeId && !isConversationEpisode(savedEpisode)) { setError('This conversation is still syncing. Retry cloud sync before resuming.'); return }
  setEpisode(isConversationEpisode(savedEpisode) ? savedEpisode : undefined); setRun(saved); setRecapDismissed(true)
 }
 async function advance(usePrepared = false) {
  if (!run || !lesson || generationLock.current) return
  generationLock.current = true; setBusy(true); setError(''); setGenerationFailed(false)
  try {
   const index = run.turn + 1
   if (episode && index < 3 && !usePrepared) {
    const records = await db.courseAttempts.where('userId').equals(userId).filter(item => item.runId === run.id).toArray()
    const dialogue: ConversationLine[] = []
    for (let i = 0; i < index; i++) {
     const answer = records.find(item => item.turnId === lesson.turns[i].id)?.answer
     if (!answer) throw new Error('Assess the current answer before continuing.')
     dialogue.push({ role: 'partner', text: episode.turns[i].npcLine }, { role: 'learner', text: answer })
    }
    const response = await generateConversation({ lessonId: lesson.id, mode: 'next-turn', episodeId: episode.id, turnIndex: index as 1 | 2, history: dialogue }, userId)
    if (!('turn' in response)) throw new Error('No follow-up was returned.')
    const updated = { ...episode, turns: episode.turns.map((turn, i) => i === index ? response.turn : turn) }
    await saveConversationDocument(userId, 'episode', episode.id, { ...updated }); setEpisode(updated)
   }
   await saveRun({ ...run, turn: index, completed: index === 3 })
   await history.refresh()
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'The next turn could not be prepared. Your assessed answer is saved.'); setGenerationFailed(true) }
  finally { generationLock.current = false; setBusy(false) }
 }
 async function downloadHistory() {
  setError('')
  try {
   await history.retry()
   const data = await exportConversationHistory(userId)
   const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
   const link = document.createElement('a'); link.href = href; link.download = `olingo-learning-history-${new Date().toISOString().slice(0, 10)}.json`; link.click()
   setTimeout(() => URL.revokeObjectURL(href), 1000)
  } catch { setError('The history export could not be created. Please retry.') }
 }
 if (!ready || initialRecap === undefined) return <section className="answer-card"><h2>Opening your conversation history…</h2><p>{history.status.message}</p></section>
 if (!recapDismissed && initialRecap) return <section className="answer-card conversation-recap"><h2>Welcome back.</h2><RecapDetails recap={initialRecap} /><p>{history.status.message}</p><div className="course-actions">{unfinished && <button className="btn btn-primary" onClick={() => void resume(unfinished)}>Resume unfinished conversation</button>}<button className="btn btn-secondary" onClick={() => setRecapDismissed(true)}>Continue to my pathway</button></div>{error && <p role="alert">{error}</p>}</section>
 if (run && lesson) {
  const evidence = lessonProgress(lesson, attempts)
  const episodeAttempts = attempts.filter(item => item.runId === run.id)
  const recap = conversationRecap(episodeAttempts, { runTitles: { [run.id]: run.title || lesson.title } })
  return <div className="page-stack conversation-course">
   <header className="course-heading"><p className="eyebrow">{lesson.level} · {episode ? 'Fresh responsive conversation' : run.variant === 'transfer' ? 'A changed situation' : 'Authored conversation'}</p><h2>{run.title || lesson.title}</h2><p>{lesson.canDo}</p></header>
   {episode?.source && <details className="course-source-provenance"><summary>Based on: {episode.source.label}</summary><p>{episode.source.excerpt}</p>{episode.source.url && /^https?:\/\//.test(episode.source.url) && <a href={episode.source.url} target="_blank" rel="noreferrer">Open source</a>}</details>}
   {run.turn < lesson.turns.length ? <CourseSpeakingTurn key={`${run.id}:${run.turn}`} userId={userId} lesson={lesson} run={run} episode={episode} advancing={busy}
    onSaved={history.refresh} onNext={() => void advance()} onLeave={() => { setRun(null); setEpisode(undefined) }} /> :
    <section className="answer-card course-finish"><p className="eyebrow">Episode complete</p>{recap && <RecapDetails recap={recap} />}
     <p>{evidence.coveredTurnIds.length} of {lesson.turns.length} goals demonstrated independently across this area. {evidence.contexts.length} situations represented.</p>
     <ul>{evidence.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
     <div className="course-actions"><button className="btn btn-primary" disabled={busy} onClick={() => { setRun(null); setEpisode(undefined) }}>Back to my pathway</button><button className="btn btn-secondary" disabled={busy} onClick={() => void startFresh(lesson)}>Try a fresh situation</button></div>
    </section>}
   {error && <p role="alert">{error}</p>}
   {generationFailed && run.turn < 2 && <div className="course-actions"><button className="btn btn-primary" disabled={busy} onClick={() => void advance()}>Retry responsive follow-up</button><button className="btn btn-secondary" disabled={busy} onClick={() => void advance(true)}>Use the prepared next turn</button></div>}
   <p className="muted" role="status">{busy ? 'Preparing your next conversational turn…' : history.status.message}</p>
  </div>
 }
 return <div className="page-stack conversation-course">
  <header className="course-heading"><p className="eyebrow">Your conversational pathway</p><h2>Italian for things you want to say.</h2><p>Fresh situations, a partner who responds to you, and a record of what is becoming easier.</p></header>
  <div className="course-sync-status"><p role="status">{history.status.message}</p>{!history.localMode && history.status.state !== 'synced' && <button className="btn btn-secondary" onClick={() => void history.retry()}>Retry cloud sync</button>}<button className="btn btn-secondary" onClick={() => void downloadHistory()}>Export my learning history</button></div>
  {error && <p role="alert">{error}</p>}
  {unfinished && <section className="course-recommendation"><p>You have an unfinished conversation: <strong>{unfinished.title || courseLessons.find(item => item.id === unfinished.lessonId)?.title}</strong>.</p><button className="btn btn-secondary" disabled={busy} onClick={() => void resume(unfinished)}>Resume unfinished conversation</button></section>}
  <div className="course-levels" aria-label="Choose practice level">{courseLevels.map(item => <button key={item.level} disabled={busy} aria-pressed={targetLevel === item.level} onClick={() => void chooseLevel(item.level)}>{item.level}</button>)}</div>
  <section className="course-level-summary"><h3>{level.title}</h3><p>{level.description}</p></section>
  {advice && levelAcknowledged !== targetLevel && <section className="course-level-advice" aria-label="Level guidance"><h3>{advice.title}</h3><p>{advice.message}</p><p>Material far above your comfortable level can leave less room for useful speaking practice. A short foundation check can help you choose.</p><div className="course-actions"><button className="btn btn-primary" disabled={busy} onClick={() => void (async () => { await chooseLevel(advice.suggestedLevel); await startAuthored(courseLessons.find(item => item.id === advice.lessonId)!, 'base') })()}>{advice.sampleLabel}</button><button className="btn btn-secondary" onClick={() => setLevelAcknowledged(targetLevel)}>{advice.continueLabel}</button></div></section>}
  <details className="answer-card course-preferences"><summary>Bring your interests or a source</summary><label htmlFor="course-interests">Interests, separated by commas</label><input id="course-interests" value={interests} disabled={busy} maxLength={480} placeholder="Gardening, music, travel, creative writing…" onChange={event => setInterests(event.target.value)} onBlur={() => void rememberPreferences().catch(() => setError('Your interests could not be saved.'))} />
   <p>For a source-based conversation, add a short extract. You can also send a reading from Sources.</p><label htmlFor="course-source-label">Title or source label</label><input id="course-source-label" value={sourceLabel} disabled={busy} maxLength={160} onChange={event => setSourceLabel(event.target.value)} /><label htmlFor="course-source-url">Source link (optional)</label><input id="course-source-url" type="url" value={sourceUrl} disabled={busy} maxLength={500} onChange={event => setSourceUrl(event.target.value)} /><label htmlFor="course-source-text">Extract or your own notes</label><textarea id="course-source-text" rows={5} value={sourceText} disabled={busy} maxLength={8000} onChange={event => setSourceText(event.target.value)} /><p>The fresh episode will use this material at your selected level. Source facts and invented role-play details are kept distinct.</p>{sourceText && <button className="btn btn-secondary" disabled={busy} onClick={() => { setSourceText(''); setSourceLabel(''); setSourceUrl('') }}>Clear source</button>}
  </details>
  {recommendation && <section className="course-recommendation"><p className="eyebrow">Suggested next conversation</p><h3>{recommendation.lesson.title}</h3><p>{recommendation.reason}</p><div className="course-actions"><button className="btn btn-primary" disabled={busy} onClick={() => void startFresh(recommendation.lesson)}>{busy ? 'Preparing conversation…' : 'Start a fresh conversation'}</button><button className="btn btn-secondary" disabled={busy} onClick={() => void startAuthored(recommendation.lesson, recommendation.variant, recommendation.repairTurnId)}>Use an authored episode</button></div><p className="muted">Three turns, then stop or continue. Your answers shape the follow-up.</p></section>}
  <ConversationGarden level={targetLevel} attempts={attempts} onChooseLesson={id => { if (!busy) void startFresh(courseLessons.find(item => item.id === id)!) }} />
  <section className="course-evidence"><h3>{readiness.stableLessons} / {readiness.totalLessons} areas currently supported by delayed spoken evidence</h3><p>{readiness.note}</p></section>
  <details><summary>Browse all conversational goals</summary><div className="course-grid">{courseStrands.map(strand => {
   const item = courseLessons.find(candidate => candidate.level === targetLevel && candidate.strandId === strand.id)!
   const evidence = lessonProgress(item, attempts)
   return <article className="course-card" key={strand.id}><span className={`course-status course-status-${evidence.status}`}>{evidence.status === 'stable' ? 'Delayed evidence' : evidence.status === 'review' ? 'Revisit due' : evidence.status}</span><h3>{strand.title}</h3><p>{item.canDo}</p><details><summary>What changes here?</summary><p>{item.grammar.join(' · ')}</p><ul>{evidence.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details><div className="course-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => void startFresh(item)}>Fresh conversation</button><button className="btn btn-secondary" disabled={busy} onClick={() => void startAuthored(item, evidence.readyForTransfer ? 'transfer' : 'base')}>Authored practice</button></div></article>
  })}</div></details>
  <details className="answer-card"><summary>How the programme progresses</summary><p>Each level revisits twelve areas with greater independence, range and nuance. Use the skill in different situations and retrieve it on later days. A pause or lapse leads to a local review; achieved growth stays visible.</p><p>Typed and hinted answers count as practice. Independent spoken evidence across three goals, different situations and days at least 24 hours apart supports establishment. These are practice indicators, not a CEFR qualification.</p><p>At C2, fresh topics, audiences, interpretations and sources keep the practice open-ended. Continue authentic listening, reading and live conversation alongside the app.</p><Link to="/drills">Use short grammar drills for a specific repair</Link></details>
 </div>
}

function CourseSpeakingTurn({ userId, lesson, run, episode, advancing, onSaved, onNext, onLeave }: {
 userId: string; lesson: CourseLesson; run: Run; episode?: GeneratedConversationEpisode; advancing: boolean; onSaved: () => Promise<void>; onNext: () => void; onLeave: () => void
}) {
 const turn = episode ? generatedCourseTurn(episode, run.turn) : lesson.turns[run.turn]
 const exercise = courseExercise(lesson, turn, run.variant)
 if (episode) { exercise.id = `conversation:${episode.id}:${turn.id}`; exercise.npcLine = turn.npcLine; exercise.promptEnglish = `${episode.context}\nYour conversation partner says: ${turn.npcLine}\n${turn.instruction}` }
 useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [exercise.id])
 const [answer, setAnswer] = useState('')
 const supportKey = `olingo.course-support.${userId}.${exercise.id}`
 const [hint, setHint] = useState(() => { try { return localStorage.getItem(supportKey) === 'seen' } catch { return false } })
 const [flow, setFlow] = useState<CourseAttempt['flow']>('unreported')
 const [feedback, setFeedback] = useState<EvaluationResult | null>(null)
 const [busy, setBusy] = useState(false)
 const [active, setActive] = useState(false)
 const [startedAt] = useState(Date.now)
 const attemptId = useRef(`${run.id}:${turn.id}`)
 const [restored, setRestored] = useState(false)
 const lock = useRef(false)
 const playback = useRef<HTMLAudioElement | null>(null)
 const speech = useSentenceSpeech({ userId, exerciseId: exercise.id, resetKey: exercise.id, onTranscript: setAnswer, hintsUsed: hint ? 1 : 0, wordBankUsed: false })
 const locked = advancing || busy || speech.loading || active || !restored
 function revealHint() {
  try { localStorage.setItem(supportKey, 'seen'); setHint(true) }
  catch { speech.setError('The cue could not be saved. Please reload before using assisted practice.') }
 }
 useEffect(() => {
  let cancelled = false
  void db.courseAttempts.where('userId').equals(userId).filter(item => item.runId === run.id && item.turnId === turn.id).first().then(saved => {
   if (cancelled) return
   if (saved?.assessment) { setFeedback(saved.assessment); setAnswer(saved.answer ?? ''); setFlow(saved.flow) }
   setRestored(true)
  }).catch(() => { if (!cancelled) speech.setError('Your saved answer could not be opened. Reload before continuing.') })
  return () => { cancelled = true }
 }, [userId, run.id, turn.id])
 async function assess() {
  if (lock.current || locked || feedback || !answer.trim() || !speech.ready) return
  lock.current = true; setBusy(true); speech.setError(null)
  const draft = speech.draft
  const id = draft?.attemptId ?? attemptId.current
  const hintsUsed = Math.max(hint ? 1 : 0, draft?.hintsUsed ?? 0)
  try {
   const state = await db.exerciseStates.get([userId, exercise.id]) ?? createExerciseState(userId, exercise.id)
   const { result } = await submitExerciseAnswer({ userId, item: { exercise, state, skillId: `conversation:${lesson.level}:${lesson.strandId}` }, answer: answer.trim(), targetLevel: lesson.level,
    courseEvidence: { contextId: episode?.id, runId: run.id, lessonId: lesson.id, turnId: turn.id, variant: run.variant, flow, practicedAt: draft?.recordedAt },
    hintsUsed, spokenFirst: Boolean(draft), spoken: Boolean(draft), attemptId: id, mode: 'conversation-course', msUsed: Date.now() - startedAt,
    speechEvidence: draft ? { rawTranscript: draft.rawTranscript, confirmedTranscript: answer.trim(), recordingDurationMs: draft.recordingDurationMs, speechOnsetMs: draft.responseLatencyMs, utteranceDurationMs: draft.utteranceDurationMs, timingBasis: draft.timingBasis } : undefined,
    utteranceDurationMs: draft?.utteranceDurationMs ?? undefined,
   })
   try { localStorage.removeItem(supportKey) } catch { /* Retain conservative support evidence if storage is unavailable. */ }
   setFeedback(result)
   window.dispatchEvent(new CustomEvent('olingo:conversation-changed', { detail: { userId, source: 'local' } }))
   await onSaved()
   await speech.clearAfterAssessment().catch(() => speech.setError('Your result was saved, but the recording draft could not be cleared.'))
  } catch (cause) { speech.setError(cause instanceof Error ? cause.message : 'Assessment could not be saved. Your answer is kept here; retry when ready.') }
  finally { lock.current = false; setBusy(false) }
 }
 return <section className="answer-card course-turn">
  <div className="course-turn-top"><p className="eyebrow">Turn {run.turn + 1} of {lesson.turns.length}</p><button className="btn btn-secondary" disabled={locked} onClick={onLeave}>Return to pathway</button></div>
  <p>{run.variant === 'base' ? turn.context : turn.transferContext}</p>
  {exercise.npcLine && <div className="course-partner"><span className="eyebrow">Your conversation partner</span><p lang="it">{exercise.npcLine}</p><button className="btn btn-secondary" disabled={locked} onClick={() => void speak(exercise.npcLine!)}>Listen</button></div>}
  <h3>{run.variant === 'base' ? turn.instruction : turn.transferInstruction}</h3>
  <p className="muted">Speak naturally. There can be several good answers. Check the transcript before assessment; correct what was misheard, keeping what you actually said.</p>
  {!feedback && <>
   <SentenceVoiceRecorder key={exercise.id} busy={busy || speech.loading} maxDurationMs={lesson.level === 'C1' || lesson.level === 'C2' ? 120_000 : 60_000} disabled={!speech.ready || !restored} onRecording={speech.recording} onActiveChange={value => { setActive(value); if (value) { playback.current?.pause(); stopCurrentAudio() } }} />
   <button className="btn btn-secondary" disabled={locked} onClick={revealHint}>Give me a cue</button>
   {(hint || Boolean(speech.draft?.hintsUsed)) && <p className="course-hint">{turn.hint}</p>}
  </>}
  {speech.audioUrl && <audio ref={playback} controls={!active} src={speech.audioUrl} aria-label="Your recorded answer" />}
  {speech.draft && <p className="muted">Recording: {(speech.draft.recordingDurationMs / 1000).toFixed(1)} s. {speech.draft.responseLatencyMs !== null ? `Voice began ${(speech.draft.responseLatencyMs / 1000).toFixed(1)} s after recording started.` : 'Voice onset unavailable.'} This is not a prompt-to-answer speed score.</p>}
  <label className="course-answer-label" htmlFor="course-answer">{speech.draft ? 'What you said' : 'Or practise with a typed answer'}</label>
  <textarea id="course-answer" rows={4} value={answer} disabled={locked || Boolean(feedback) || !speech.ready} onChange={event => speech.editTranscript(event.target.value)} placeholder="Your Italian answer…" />
  {!feedback && <>
   <label htmlFor="course-flow">How did speaking feel?</label><select id="course-flow" value={flow} disabled={locked} onChange={event => setFlow(event.target.value as CourseAttempt['flow'])}><option value="unreported">Not reported</option><option value="fluent">Flowed naturally</option><option value="hesitant">Some hesitation</option><option value="rebuilt">I rebuilt the sentence</option></select>
   <div className="course-actions"><button className="btn btn-primary" disabled={locked || !speech.ready || !answer.trim()} onClick={() => void assess()}>{busy ? 'Assessing your answer…' : speech.draft ? 'Confirm transcript and assess' : 'Assess typed practice'}</button>{speech.draft && <><button className="btn btn-secondary" disabled={locked} onClick={() => void speech.transcribe()}>Retry transcription</button><button className="btn btn-secondary" disabled={locked} onClick={() => void speech.discard()}>Discard recording</button></>}</div>
  </>}
  {speech.error && <p role="alert">{speech.error}</p>}
  {feedback && <div className="course-feedback" aria-live="polite"><h3>{!feedback.exerciseValid ? 'Prompt needs review' : feedback.accepted ? 'That works in this conversation.' : feedback.communicative ? 'Your meaning came across. One repair:' : 'Let’s make that easier to understand.'}</h3><p>{feedback.shortFeedback || feedback.message}</p>{!feedback.accepted && feedback.correctedItalian && <p lang="it">{feedback.correctedItalian}</p>}
   <details><summary>One possible answer</summary><p lang="it">{exercise.targetItalian}</p><p>Your wording can differ while meeting the same conversational goal.</p></details>
   {feedback.errorTags.length > 0 && <p>Revisit: {feedback.errorTags.join(', ')}</p>}
   <button className="btn btn-primary" disabled={busy || advancing} onClick={onNext}>{advancing ? 'Preparing follow-up…' : run.turn === lesson.turns.length - 1 ? 'Finish this episode' : 'Next conversational turn'}</button>
  </div>}
 </section>
}

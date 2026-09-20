import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SentenceVoiceRecorder from '@/components/SentenceVoiceRecorder'
import { useSentenceSpeech } from '@/hooks/useSentenceSpeech'
import { courseLessons, courseLevels, courseStrands, type CourseLesson } from '@/learning/conversation-course'
import { lessonProgress, levelReadiness, recommendLesson, type CourseAttempt } from '@/learning/course-progress'
import { courseExercise } from '@/learning/course-exercises'
import type { EvaluationResult } from '@/learning/evaluator'
import { submitExerciseAnswer } from '@/learning/progress'
import { createExerciseState } from '@/learning/scheduler'
import { speak, stopCurrentAudio } from '@/lib/tts'
import { db } from '@/storage/db'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'

type Run = { id: string; lessonId: string; variant: 'base' | 'transfer'; turn: number }
const runKey = (userId: string) => `olingo.conversation-run.${userId}`
function restoredRun(userId: string): Run | null {
 try {
  const run = JSON.parse(localStorage.getItem(runKey(userId)) || 'null') as Run | null
  const lesson = courseLessons.find(item => item.id === run?.lessonId)
  return run && typeof run.id === 'string' && lesson && ['base', 'transfer'].includes(run.variant) && Number.isInteger(run.turn) && run.turn >= 0 && run.turn <= lesson.turns.length ? run : null
 } catch { return null }
}

export default function ConversationCourse() {
 const { userId } = useAuth()
 return <CourseForLearner key={userId} userId={userId} />
}
function CourseForLearner({ userId }: { userId: string }) {
 const { targetLevel, setTargetLevel } = useSettings()
 const [attempts, setAttempts] = useState<CourseAttempt[]>([])
 const [ready, setReady] = useState(false)
 const [error, setError] = useState('')
 const [run, setRun] = useState<Run | null>(() => restoredRun(userId))
 async function refresh() {
  try { setAttempts(await db.courseAttempts.where('userId').equals(userId).toArray()); setReady(true); setError('') }
  catch { setError('Your conversation history could not be opened. Please reload before starting.') }
 }
 useEffect(() => { void refresh() }, [userId])
 useEffect(() => {
  try { if (run) localStorage.setItem(runKey(userId), JSON.stringify(run)); else localStorage.removeItem(runKey(userId)) } catch { /* Audio drafts are still held in IndexedDB. */ }
 }, [run, userId])
 const recommendation = recommendLesson(targetLevel, attempts)
 const readiness = levelReadiness(targetLevel, attempts)
 const lesson = courseLessons.find(item => item.id === run?.lessonId)
 const level = courseLevels.find(item => item.level === targetLevel)!
 function start(item: CourseLesson, variant: Run['variant'], repairTurnId?: string) { setRun({ id: crypto.randomUUID(), lessonId: item.id, variant, turn: Math.max(0, item.turns.findIndex(turn => turn.id === repairTurnId)) }) }
 if (run && lesson) {
  const evidence = lessonProgress(lesson, attempts)
  const episodeAttempts = attempts.filter(item => item.runId === run.id)
  const repairs = [...new Set(episodeAttempts.flatMap(item => item.assessment?.errorTags ?? []))]
  return <div className="page-stack conversation-course">
   <header className="course-heading"><p className="eyebrow">{lesson.level} · {run.variant === 'transfer' ? 'A changed situation' : 'Conversation episode'}</p><h2>{lesson.title}</h2><p>{lesson.canDo}</p></header>
   {run.turn < lesson.turns.length ? <CourseSpeakingTurn key={`${run.id}:${lesson.id}:${run.variant}:${run.turn}`} userId={userId} lesson={lesson} run={run}
    onSaved={refresh} onNext={() => setRun({ ...run, turn: run.turn + 1 })} onLeave={() => setRun(null)} /> :
    <section className="answer-card course-finish"><p className="eyebrow">Episode complete</p><h3>Keep what worked. Return to what needs time.</h3>
     <p>This episode: {episodeAttempts.filter(item => item.accepted).length} / {episodeAttempts.length} accepted answers; {episodeAttempts.filter(item => item.spoken).length} recorded, {episodeAttempts.filter(item => !item.spoken).length} typed. {episodeAttempts.filter(item => item.flow === 'fluent').length} reported as flowing naturally.</p>
     <p>{evidence.successfulSpokenAttempts} successful unassisted spoken answers across this episode’s history. {evidence.coveredTurnIds.length} of {lesson.turns.length} conversational goals demonstrated.</p>
     <ul>{evidence.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
     <p>Next targets: {repairs.length ? `revisit ${repairs.slice(0, 2).join(' and ')}; then use the repaired language in a changed situation.` : 'use the same skill in a changed situation; then revisit it on another day.'} A hesitation can be useful evidence; it does not erase earlier progress.</p>
     <div className="course-actions"><button className="btn btn-primary" onClick={() => setRun(null)}>Back to my pathway</button><button className="btn btn-secondary" onClick={() => start(lesson, 'transfer')}>Try a changed situation</button></div>
    </section>}
  </div>
 }
 return <div className="page-stack conversation-course">
  <header className="course-heading"><p className="eyebrow">Your conversational pathway</p><h2>Italian for things you want to say.</h2><p>Questions, everyday exchanges and increasingly demanding conversations. One spoken turn at a time.</p></header>
  {error && <p role="alert">{error}</p>}
  <div className="course-levels" aria-label="Choose practice level">{courseLevels.map(item => <button key={item.level} aria-pressed={targetLevel === item.level} onClick={() => setTargetLevel(item.level)}>{item.level}</button>)}</div>
  <section className="course-level-summary"><h3>{level.title}</h3><p>{level.description}</p><p className="muted">Choose a useful starting point. You can revisit easier skills at any time; strong grammar and easy conversation do not always develop together.</p></section>
  {recommendation && <section className="course-recommendation"><p className="eyebrow">Suggested next conversation</p><h3>{recommendation.lesson.title}</h3><p>{recommendation.reason}</p>
   {recommendation.needsEasyRepair && <p>Start with the hint and a short answer. We will keep the repair local to this skill.</p>}
   <button className="btn btn-primary" disabled={!ready} onClick={() => start(recommendation.lesson, recommendation.variant, recommendation.repairTurnId)}>Start three spoken turns</button><span className="muted">Then stop or choose another episode.</span>
  </section>}
  <section className="course-evidence"><h3>{readiness.stableLessons} / {readiness.totalLessons} episodes supported by delayed spoken evidence</h3><p>{readiness.note}</p><p>Progress is saved on this device. Recording and assessment use your existing Olingo connection.</p></section>
  <div className="course-grid">{courseStrands.map(strand => {
   const item = courseLessons.find(candidate => candidate.level === targetLevel && candidate.strandId === strand.id)!
   const evidence = lessonProgress(item, attempts)
   return <article className="course-card" key={strand.id}><span className={`course-status course-status-${evidence.status}`}>{evidence.status === 'stable' ? 'Delayed evidence' : evidence.status === 'review' ? 'Revisit due' : evidence.status}</span><h3>{strand.title}</h3><p>{item.canDo}</p><details><summary>What changes here?</summary><p>{strand.description}</p><p>{item.grammar.join(' · ')}</p><ul>{evidence.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details><button className="btn btn-secondary" disabled={!ready} onClick={() => start(item, evidence.readyForTransfer ? 'transfer' : 'base')}>{evidence.attempts ? 'Practise again' : 'Explore conversation'}</button></article>
  })}</div>
  <details className="answer-card"><summary>How the programme progresses</summary><p>Each level revisits the same 12 areas with greater independence, range and nuance. Begin with a short exchange, use it in a changed situation, then retrieve it on a later day. Recent difficulty brings a smaller step and support; it never resets your whole course.</p><p>Typed or hinted answers count as practice. Readiness requires unassisted recorded speech across all three goals, both situations, and days at least 24 hours apart. Review intervals are a practical scheduling rule, not a CEFR test.</p><p>At C2, continue with changed situations to practise ambiguity, register, synthesis and sensitive disagreement. There is no official C3. These activities support development; broad listening, reading and live interaction remain part of reaching advanced proficiency.</p><Link to="/drills">Use short grammar drills when a specific form needs repair</Link></details>
 </div>
}

function CourseSpeakingTurn({ userId, lesson, run, onSaved, onNext, onLeave }: {
 userId: string; lesson: CourseLesson; run: Run; onSaved: () => Promise<void>; onNext: () => void; onLeave: () => void
}) {
 const turn = lesson.turns[run.turn]
 const exercise = courseExercise(lesson, turn, run.variant)
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
 const locked = busy || speech.loading || active || !restored
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
    courseEvidence: { runId: run.id, lessonId: lesson.id, turnId: turn.id, variant: run.variant, flow, practicedAt: draft?.recordedAt },
    hintsUsed, spokenFirst: Boolean(draft), spoken: Boolean(draft), attemptId: id, mode: 'conversation-course', msUsed: Date.now() - startedAt,
    speechEvidence: draft ? { rawTranscript: draft.rawTranscript, confirmedTranscript: answer.trim(), recordingDurationMs: draft.recordingDurationMs, speechOnsetMs: draft.responseLatencyMs, utteranceDurationMs: draft.utteranceDurationMs, timingBasis: draft.timingBasis } : undefined,
    utteranceDurationMs: draft?.utteranceDurationMs ?? undefined,
   })
   try { localStorage.removeItem(supportKey) } catch { /* Retain conservative support evidence if storage is unavailable. */ }
   setFeedback(result)
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
   <button className="btn btn-primary" disabled={busy} onClick={onNext}>{run.turn === lesson.turns.length - 1 ? 'Finish this episode' : 'Next conversational turn'}</button>
  </div>}
 </section>
}

import type { CefrLevel } from './content'
import { courseLessons, courseLevels, courseStrands } from './conversation-course'
import { lessonProgress, type CourseAttempt } from './course-progress'

/** These helpers accept only the current learner's attempts, just like course-progress. */
function cleanAttempts(attempts: CourseAttempt[], now: Date | string): CourseAttempt[] {
  const ceiling = now instanceof Date ? now.getTime() : Date.parse(now)
  const unique = new Map<string, CourseAttempt>()
  for (const attempt of attempts) {
    const instant = Date.parse(attempt.atISO)
    const lesson = courseLessons.find(item => item.id === attempt.lessonId)
    if (!attempt.id || !Number.isFinite(instant) || instant > ceiling || !lesson?.turns.some(turn => turn.id === attempt.turnId)) continue
    if (attempt.assessment?.exerciseValid === false) continue
    const prior = unique.get(attempt.id)
    if (!prior || instant >= Date.parse(prior.atISO)) unique.set(attempt.id, attempt)
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.atISO) - Date.parse(b.atISO))
}

export interface ConversationRecap {
  runId: string | null
  title: string
  level: CefrLevel
  atISO: string
  completed: boolean
  answered: number
  totalTurns: number
  accepted: number
  spoken: number
  assisted: number
  fluent: number
  acceptedPoints: string[]
  targets: string[]
}
export interface ConversationRecapOptions {
  now?: Date | string
  runTitles?: Record<string, string>
  runs?: Record<string, { title?: string; expectedTurnIds?: string[] }>
}

/** Last actual assessed episode, including a partial one. Dates never imply practice. */
export function conversationRecap(attempts: CourseAttempt[], options: ConversationRecapOptions = {}): ConversationRecap | null {
  const ordered = cleanAttempts(attempts, options.now ?? new Date())
  const latest = ordered[ordered.length - 1]
  if (!latest) return null
  const lesson = courseLessons.find(item => item.id === latest.lessonId)!
  // A legacy answer without a run ID is one known answer, not an invented session.
  const run = latest.runId
    ? ordered.filter(item => item.runId === latest.runId && item.lessonId === latest.lessonId)
    : [latest]
  const metadata = latest.runId ? options.runs?.[latest.runId] : undefined
  const expected = metadata?.expectedTurnIds?.length
    ? metadata.expectedTurnIds
    : lesson.turns.map(turn => turn.id)
  const answeredIds = new Set(run.map(item => item.turnId))
  const accepted = run.filter(item => item.accepted && item.communicative)
  const acceptedPoints = [...new Set([...accepted].reverse().map(item => {
    const text = item.answer?.trim()
    return text ? `“${text.length > 180 ? `${text.slice(0, 177)}…` : text}”` : `Accepted answer in ${courseStrands.find(strand => strand.id === lesson.strandId)?.title.toLowerCase() ?? lesson.title}.`
  }))].slice(0, 2)
  const targets: string[] = []
  for (const attempt of [...run].reverse()) {
    if (attempt.accepted && attempt.communicative) continue
    // A later successful repair of this same capability need not remain today's top error.
    if (run.some(later => later.turnId === attempt.turnId && later.accepted && later.communicative && Date.parse(later.atISO) > Date.parse(attempt.atISO))) continue
    const specific = attempt.assessment?.shortFeedback?.trim()
    const tags = (attempt.assessment?.errorTags ?? []).map(tag => tag.replace(/[-_]+/g, ' ')).filter(Boolean)
    const target = specific || (tags.length ? `Revisit ${tags.slice(0, 2).join(' and ')}.` : `Try the ${lesson.title.toLowerCase()} exchange again with a short answer.`)
    if (!targets.includes(target)) targets.push(target)
    if (targets.length === 2) break
  }
  if (!targets.length) {
    if (run.some(item => item.hintsUsed > 0)) targets.push('Try one of these responses again without the cue.')
    if (!run.some(item => item.spoken)) targets.push('Try one response aloud; typed practice has not yet shown spoken retrieval.')
    else if (run.some(item => item.flow === 'hesitant' || item.flow === 'rebuilt')) targets.push('Keep the meaning, but make one hesitant response shorter and easier to say.')
    else targets.push('Use the same conversational skill in a new situation, then revisit it on another day.')
  }
  return {
    runId: latest.runId ?? null,
    title: (latest.runId ? options.runTitles?.[latest.runId] : undefined) || metadata?.title || lesson.title,
    level: lesson.level,
    atISO: latest.atISO,
    completed: Boolean(latest.runId) && expected.every(id => answeredIds.has(id)),
    answered: answeredIds.size,
    totalTurns: expected.length,
    accepted: accepted.length,
    spoken: run.filter(item => item.spoken).length,
    assisted: run.filter(item => item.hintsUsed > 0).length,
    fluent: run.filter(item => item.spoken && item.flow === 'fluent').length,
    acceptedPoints,
    targets: targets.slice(0, 2),
  }
}

export interface ConversationLevelAdvice {
  title: string
  message: string
  suggestedLevel: CefrLevel
  lessonId: string
  continueLabel: string
  sampleLabel: string
}
const foundationStrands = ['social', 'questions', 'routines', 'food', 'shopping', 'travel']

/** Optional sampling advice, never a level lock or an inference about unobserved ability. */
export function conversationLevelAdvice(level: CefrLevel, attempts: CourseAttempt[], now: Date | string = new Date()): ConversationLevelAdvice | null {
  const rank = courseLevels.findIndex(item => item.level === level)
  if (rank <= 0) return null
  const ordered = cleanAttempts(attempts, now)
  const foundations = courseLessons.filter(item => item.level === 'A1' && foundationStrands.includes(item.strandId))
  const foundationRows = foundations.map(lesson => ({ lesson, progress: lessonProgress(lesson, ordered, now) }))
  const demonstratedBasics = foundationRows.filter(({ lesson, progress }) => progress.coveredTurnIds.length === lesson.turns.length)
  const selectedRows = courseLessons.filter(item => item.level === level).map(lesson => lessonProgress(lesson, ordered, now))
  // Established independent evidence at the selected level is meaningful even if a
  // returning/advanced learner has never chosen our beginner episodes.
  if (selectedRows.filter(item => item.stable).length >= 6) return null
  if (demonstratedBasics.length < 4) {
    const sample = foundationRows.find(row => row.lesson.strandId === 'questions' && row.progress.coveredTurnIds.length < row.lesson.turns.length)
      ?? foundationRows.find(row => row.progress.coveredTurnIds.length < row.lesson.turns.length)!
    const independent = foundationRows.reduce((sum, row) => sum + row.progress.successfulSpokenAttempts, 0)
    return {
      title: independent ? 'A quick check of everyday questions may help' : 'We have not sampled your foundations yet',
      message: `The app has evidence across all three speaking goals in ${demonstratedBasics.length} of 6 everyday foundation areas. This does not mean you lack the ability: you may already know them. You can sample a short A1 exchange or continue at ${level}.`,
      suggestedLevel: 'A1', lessonId: sample.lesson.id,
      continueLabel: `Continue at ${level}`, sampleLabel: 'Sample everyday foundations',
    }
  }
  const previousLevel = courseLevels[rank - 1].level
  const previous = courseLessons.filter(item => item.level === previousLevel).map(lesson => ({ lesson, progress: lessonProgress(lesson, ordered, now) }))
  const stable = previous.filter(row => row.progress.stable).length
  if (stable >= 6) return null
  const candidate = previous.find(row => row.progress.needsEasyRepair) ?? previous.find(row => !row.progress.stable)!
  return {
    title: `An optional ${previousLevel} check before stretching`,
    message: `There is delayed, unassisted spoken evidence in ${stable} of 12 areas at ${previousLevel}. We may simply not have seen the rest yet. A short sample can help us judge the next step; you can continue at ${level} regardless.`,
    suggestedLevel: previousLevel, lessonId: candidate.lesson.id,
    continueLabel: `Continue at ${level}`, sampleLabel: `Sample ${previousLevel}`,
  }
}

export type ConversationGardenStage = 'roots' | 'growing' | 'established'
export interface ConversationGardenBed {
  lessonId: string
  strandId: string
  title: string
  level: CefrLevel
  stage: ConversationGardenStage
  stageLabel: string
  reviewDue: boolean
  reviewNeeded: boolean
  reviewReason: string | null
  evidenceLabel: string
  historicalEstablished: boolean
}

function hasEstablishedEvidence(lessonId: string, history: CourseAttempt[], now: Date | string): boolean {
  if (lessonProgress(lessonId, history, now).stable) return true
  // Retain a plant's achieved growth even when current recall needs tending. A late
  // review or lapse changes the care marker, never destroys the learner's history.
  const relevant = history.filter(item => item.lessonId === lessonId)
  for (let index = 1; index < relevant.length; index += 1) {
    const item = relevant[index]
    if (!item.accepted || !item.communicative || !item.spoken || item.hintsUsed > 0) continue
    if (lessonProgress(lessonId, relevant.slice(0, index + 1), item.atISO).stable) return true
  }
  return false
}

export function conversationGarden(level: CefrLevel, attempts: CourseAttempt[], now: Date | string = new Date()) {
  const ordered = cleanAttempts(attempts, now)
  const beds: ConversationGardenBed[] = courseStrands.map(strand => {
    const lesson = courseLessons.find(item => item.level === level && item.strandId === strand.id)!
    const progress = lessonProgress(lesson, ordered, now)
    const historicalEstablished = hasEstablishedEvidence(lesson.id, ordered, now)
    const stage: ConversationGardenStage = historicalEstablished ? 'established' : progress.successfulSpokenAttempts > 0 ? 'growing' : 'roots'
    const reviewNeeded = progress.isDue || progress.needsEasyRepair || (historicalEstablished && !progress.stable)
    const reviewReason = historicalEstablished && !progress.stable
      ? 'Keep your earlier growth. A short repair and a later successful return will refresh current evidence.'
      : progress.needsEasyRepair ? 'A short supported exchange can make the next attempt easier.'
      : progress.isDue ? 'A spaced return is due. Time away does not remove earlier progress.' : null
    const stageLabel = stage === 'established' ? 'Established evidence' : stage === 'growing' ? 'Growing through speech' : progress.attempts ? 'Roots: first practice' : 'Roots: ready to explore'
    const evidenceLabel = stage === 'established'
      ? 'Independent speech has worked across all three goals, both situations and days at least 24 hours apart.'
      : stage === 'growing'
      ? `${progress.coveredTurnIds.length} of 3 goals have successful unassisted spoken evidence. Keep returning in changed situations.`
      : progress.attempts
      ? 'Practice is recorded. Independent spoken evidence is still being gathered.'
      : 'No assessed practice here yet; this is not a judgement of your existing ability.'
    return { lessonId: lesson.id, strandId: strand.id, title: strand.title, level, stage, stageLabel, reviewDue: progress.isDue, reviewNeeded, reviewReason, evidenceLabel, historicalEstablished }
  })
  return {
    level, beds,
    establishedCount: beds.filter(bed => bed.stage === 'established').length,
    growingCount: beds.filter(bed => bed.stage === 'growing').length,
    reviewCount: beds.filter(bed => bed.reviewNeeded).length,
    note: 'Growth records practice evidence, not CEFR certification. Reviews tend what you have learnt; missed days never remove growth.',
  }
}

import { describe, expect, it } from 'vitest'
import { courseLessons } from './conversation-course'
import { conversationGarden, conversationLevelAdvice, conversationRecap } from './conversation-guidance'
import type { CourseAttempt } from './course-progress'
import type { EvaluationResult } from './evaluator'

const lesson = courseLessons.find(item => item.level === 'A1' && item.strandId === 'social')!
const dayOne = '2026-09-20T09:00:00.000Z'
const dayTwo = '2026-09-21T09:00:00.000Z'
const today = '2026-09-22T10:00:00.000Z'
function attempt(patch: Partial<CourseAttempt> = {}): CourseAttempt {
  return { id: 'attempt', runId: 'run-one', lessonId: lesson.id, turnId: lesson.turns[0].id, variant: 'base', accepted: true, communicative: true, spoken: true, hintsUsed: 0, atISO: dayOne, flow: 'fluent', ...patch }
}
function established() {
  return [...lesson.turns.map((turn, index) => attempt({ id: `base-${index}`, turnId: turn.id })), attempt({ id: 'delayed', runId: 'run-two', variant: 'transfer', atISO: dayTwo })]
}
function feedback(patch: Partial<EvaluationResult> = {}): EvaluationResult {
  return { exerciseValid: true, invalidReason: '', accepted: false, communicative: true, close: true, spellingOnly: false, outcome: 'hard', normalisedAnswer: '', message: '', shortFeedback: 'Keep the feminine plural ending in restituite.', correctedItalian: 'Le ho restituite.', meaning: '', errorTags: ['agreement'], spellingIssues: [], repairPrompts: [], confidence: .9, ...patch }
}

describe('evidence-based conversation guidance', () => {
  it('shows no invented recap without actual assessed practice', () => {
    expect(conversationRecap([], { now: today })).toBeNull()
    expect(conversationRecap([attempt({ atISO: '2030-01-01T10:00:00Z' })], { now: today })).toBeNull()
    expect(conversationRecap([attempt({ assessment: feedback({ exerciseValid: false }) })], { now: today })).toBeNull()
  })

  it('recaps the latest actual run, including a partial run and its specific repair', () => {
    const history = [...established(), attempt({ id: 'last', runId: 'run-three', atISO: today, accepted: false, assessment: feedback(), answer: 'Le ho restituiti.', flow: 'hesitant' })]
    const recap = conversationRecap(history, { now: today, runTitles: { 'run-three': 'The parcel counter' } })!
    expect(recap.title).toBe('The parcel counter')
    expect(recap.runId).toBe('run-three')
    expect(recap.atISO).toBe(today)
    expect(recap.completed).toBe(false)
    expect(recap.answered).toBe(1)
    expect(recap.accepted).toBe(0)
    expect(recap.targets).toEqual(['Keep the feminine plural ending in restituite.'])
    expect('latency' in recap).toBe(false)
  })

  it('identifies completion through actual unique goals, not duplicate submissions', () => {
    const completed = lesson.turns.map((turn, index) => attempt({ id: `answer-${index}`, turnId: turn.id, answer: `Risposta ${index + 1}` }))
    expect(conversationRecap([...completed, ...completed], { now: today })).toMatchObject({ completed: true, answered: 3, accepted: 3, spoken: 3 })
    expect(conversationRecap([attempt({ runId: undefined })], { now: today })?.completed).toBe(false)
  })

  it('keeps typed practice separate and does not label it fluent speech', () => {
    const recap = conversationRecap([attempt({ spoken: false })], { now: today })!
    expect(recap.spoken).toBe(0)
    expect(recap.fluent).toBe(0)
    expect(recap.targets[0]).toContain('typed practice has not yet shown spoken retrieval')
    const bed = conversationGarden('A1', [attempt({ spoken: false })], today).beds[0]
    expect(bed.stage).toBe('roots')
  })

  it('requires delayed transfer evidence for an established plant', () => {
    expect(conversationGarden('A1', established().map(item => ({ ...item, atISO: dayOne })), today).beds[0].stage).toBe('growing')
    expect(conversationGarden('A1', established(), today).beds[0].stage).toBe('established')
    expect(conversationGarden('A1', established().map(item => ({ ...item, hintsUsed: 1 })), today).beds[0].stage).toBe('roots')
  })

  it('never removes achieved growth because of a lapse or elapsed time', () => {
    const history = [...established(), attempt({ id: 'lapse', accepted: false, atISO: today })]
    const bed = conversationGarden('A1', history, today).beds[0]
    expect(bed.stage).toBe('established')
    expect(bed.reviewNeeded).toBe(true)
    expect(bed.reviewReason).toContain('Keep your earlier growth')
    const later = conversationGarden('A1', established(), '2027-01-01T10:00:00Z').beds[0]
    expect(later.stage).toBe('established')
    expect(later.reviewDue).toBe(true)
  })

  it('keeps the twelve strands independent and ignores unrelated evidence', () => {
    const garden = conversationGarden('A1', [...established(), attempt({ id: 'wrong-turn', turnId: 'generated-unknown-turn' })], today)
    expect(garden.beds).toHaveLength(12)
    expect(garden.establishedCount).toBe(1)
    expect(garden.beds.filter(bed => bed.stage === 'roots')).toHaveLength(11)
  })

  it('offers optional sampling, distinguishing missing evidence from missing ability', () => {
    expect(conversationLevelAdvice('A1', [], today)).toBeNull()
    const advice = conversationLevelAdvice('C2', [], today)!
    expect(advice.title).toContain('not sampled')
    expect(advice.message).toContain('does not mean you lack the ability')
    expect(advice.continueLabel).toBe('Continue at C2')
    expect(advice.lessonId).toBe('conversation-a1-questions')
  })

  it('does not insist on beginner replay when broad advanced evidence is already recorded', () => {
    const history = courseLessons.filter(item => item.level === 'B2').slice(0, 6).flatMap((item, lessonIndex) => [
      ...item.turns.map((turn, index) => attempt({ id: `advanced-${lessonIndex}-${index}`, lessonId: item.id, turnId: turn.id })),
      attempt({ id: `advanced-transfer-${lessonIndex}`, lessonId: item.id, turnId: item.turns[0].id, variant: 'transfer', atISO: dayTwo }),
    ])
    expect(conversationLevelAdvice('B2', history, today)).toBeNull()
  })
})

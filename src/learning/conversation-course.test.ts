import { describe, expect, it } from 'vitest'
import { courseLessons, courseLevels, courseStrands } from './conversation-course'

describe('authored conversation course integrity', () => {
  it('offers all twelve recurring strands at every official CEFR level', () => {
    expect(courseLevels.map(item => item.level)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    expect(courseStrands).toHaveLength(12)
    expect(courseLessons).toHaveLength(72)
    for (const { level } of courseLevels) {
      const atLevel = courseLessons.filter(lesson => lesson.level === level)
      expect(atLevel.map(lesson => lesson.strandId).sort()).toEqual(courseStrands.map(strand => strand.id).sort())
    }
  })

  it('provides complete, uniquely addressable base and changed-context retrieval tasks', () => {
    const lessonIds = courseLessons.map(lesson => lesson.id)
    expect(new Set(lessonIds).size).toBe(lessonIds.length)
    const turnIds = new Set<string>()
    for (const lesson of courseLessons) {
      expect(lesson.turns).toHaveLength(3)
      expect(lesson.canDo.trim().length).toBeGreaterThan(10)
      expect(lesson.grammar.length).toBeGreaterThan(0)
      for (const turn of lesson.turns) {
        expect(turnIds.has(turn.id)).toBe(false)
        turnIds.add(turn.id)
        for (const field of ['context', 'npcLine', 'instruction', 'example', 'hint', 'transferContext', 'transferInstruction', 'transferExample'] as const) {
          expect(turn[field].trim(), `${turn.id}.${field}`).not.toBe('')
        }
        expect(turn.transferContext).not.toBe(turn.context)
        expect(turn.transferExample).not.toBe(turn.example)
      }
    }
    expect(turnIds.size).toBe(216)
  })
})

import type { CourseLesson, CourseTurn } from './conversation-course'
import type { Exercise } from './content'
import { difficultyForCefr } from './learning-profile'

export function courseExercise(lesson: CourseLesson, turn: CourseTurn, variant: 'base' | 'transfer'): Exercise {
	const context = variant === 'transfer' ? turn.transferContext : turn.context
	const instruction = variant === 'transfer' ? turn.transferInstruction : turn.instruction
	const example = variant === 'transfer' ? turn.transferExample : turn.example
	return {
		id: `course:${lesson.id}:${turn.id}:${variant}`,
		type: 'scene', sceneId: `course-${lesson.strandId}`, cefrLevel: lesson.level,
		difficulty: difficultyForCefr(lesson.level), phase: 'speak', action: 'Converse',
		promptEnglish: `${context}\n${instruction}`,
		targetItalian: example,
		acceptedItalian: variant === 'base' ? turn.alternatives ?? [] : [],
		hints: [turn.hint],
		tags: ['conversation', lesson.strandId, ...lesson.grammar],
		phraseFamily: lesson.canDo,
		communicativeGoal: `${lesson.canDo}. ${instruction}`,
		evaluationMode: 'open-goal',
		npcLine: variant === 'base' ? turn.npcLine : undefined,
		repairPrompts: [turn.transferInstruction],
		strand: 'output',
	}
}

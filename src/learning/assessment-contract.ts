/** The semantic assessment contract shared by the API and its client. */
export type SemanticAssessment = {
	exerciseValid: boolean
	invalidReason: string
	accepted: boolean
	communicative: boolean
	correctedItalian: string
	meaning: string
	errorTags: string[]
	shortFeedback: string
	repairPrompts: string[]
	confidence: number
}

export const assessmentUnavailableMessage =
	'Assessment is unavailable. Your answer has not been scored and your progress has not changed. Please try again.'

export class AssessmentUnavailableError extends Error {
	constructor(message = assessmentUnavailableMessage) {
		super(message)
		this.name = 'AssessmentUnavailableError'
	}
}

export function isSemanticAssessment(value: unknown): value is SemanticAssessment {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false
	const data = value as Record<string, unknown>
	if (!['exerciseValid', 'accepted', 'communicative'].every((key) => typeof data[key] === 'boolean')) return false
	if (!['invalidReason', 'correctedItalian', 'meaning', 'shortFeedback'].every((key) => typeof data[key] === 'string')) return false
	if (!['errorTags', 'repairPrompts'].every((key) => Array.isArray(data[key]) && (data[key] as unknown[]).every((item) => typeof item === 'string'))) return false
	if (typeof data.confidence !== 'number' || !Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1) return false
	if (!(data.shortFeedback as string).trim()) return false
	if (data.exerciseValid && !(data.correctedItalian as string).trim()) return false
	if (!data.exerciseValid && !(data.invalidReason as string).trim()) return false
	if (data.accepted && !data.communicative) return false
	return true
}

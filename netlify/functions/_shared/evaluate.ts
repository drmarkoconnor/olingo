type ExercisePayload = {
	promptEnglish: string
	targetItalian: string
	acceptedItalian?: string[]
	tags?: string[]
	repairPrompts?: string[]
}

export type StructuredEvaluation = {
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

const accentMap: Record<string, string> = {
	à: 'a',
	è: 'e',
	é: 'e',
	ì: 'i',
	ò: 'o',
	ù: 'u',
}

const grammarWords = new Set([
	'e',
	'a',
	'al',
	'alla',
	'il',
	'lo',
	'la',
	'i',
	'gli',
	'le',
	'mi',
	'ti',
	'si',
	'ci',
	'vi',
	'ho',
	'hai',
	'ha',
	'sono',
	'sei',
	'era',
	'ero',
	'ne',
	'di',
	'da',
	'in',
	'con',
	'che',
])

export function normalise(value: string) {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFC')
		.replace(/[àèéìòù]/g, (letter) => accentMap[letter] ?? letter)
		.replace(/['’]/g, ' ')
		.replace(/[.,!?;:()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function overlap(answer: string, target: string, contentOnly = false) {
	const answerTokens = new Set(
		answer
			.split(' ')
			.filter(Boolean)
			.filter((token) => !contentOnly || (token.length > 2 && !grammarWords.has(token)))
	)
	const targetTokens = target
		.split(' ')
		.filter(Boolean)
		.filter((token) => !contentOnly || (token.length > 2 && !grammarWords.has(token)))
	if (!targetTokens.length) return 0
	const hits = targetTokens.filter((token) => answerTokens.has(token)).length
	return hits / targetTokens.length
}

export function deterministicEvaluation(
	exercise: ExercisePayload,
	answer: string
): StructuredEvaluation {
	const target = normalise(exercise.targetItalian)
	const candidate = normalise(answer)
	const accepted = [exercise.targetItalian, ...(exercise.acceptedItalian ?? [])].some(
		(value) => normalise(value) === candidate
	)
	const wholeScore = overlap(candidate, target)
	const contentScore = overlap(candidate, target, true)
	const communicative = accepted || wholeScore >= 0.72 || contentScore >= 0.62
	const repairPrompts = exercise.repairPrompts?.length
		? exercise.repairPrompts
		: [exercise.promptEnglish]

	return {
		exerciseValid: true,
		invalidReason: '',
		accepted,
		communicative,
		correctedItalian: exercise.targetItalian,
		meaning: exercise.promptEnglish,
		errorTags: accepted ? [] : (exercise.tags ?? []).slice(0, communicative ? 2 : 4),
		shortFeedback: accepted
			? 'Accurate and usable.'
			: communicative
			? 'The idea would probably land. Use the model to tighten it.'
			: 'Not usable yet, but this is exactly what repair practice is for.',
		repairPrompts,
		confidence: accepted ? 0.96 : communicative ? 0.72 : 0.42,
	}
}

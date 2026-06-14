import type { Exercise } from '@/learning/content'

export type ExerciseOutcome = 'again' | 'hard' | 'good' | 'easy'

export type EvaluationResult = {
	accepted: boolean
	communicative: boolean
	close: boolean
	spellingOnly: boolean
	outcome: ExerciseOutcome
	normalisedAnswer: string
	message: string
	shortFeedback: string
	correctedItalian: string
	meaning: string
	errorTags: string[]
	spellingIssues: { answer: string; correction: string }[]
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

export function normaliseItalian(value: string) {
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

function tokenOverlap(answer: string, target: string) {
	const answerTokens = new Set(answer.split(' ').filter(Boolean))
	const targetTokens = target.split(' ').filter(Boolean)
	if (!targetTokens.length) return 0
	const hits = targetTokens.filter((token) => answerTokens.has(token)).length
	return hits / targetTokens.length
}

function contentTokenOverlap(answer: string, target: string) {
	const answerTokens = new Set(
		answer
			.split(' ')
			.filter((token) => token.length > 2 && !grammarShortWords.has(token))
	)
	const targetTokens = target
		.split(' ')
		.filter((token) => token.length > 2 && !grammarShortWords.has(token))
	if (!targetTokens.length) return tokenOverlap(answer, target)
	const hits = targetTokens.filter((token) => answerTokens.has(token)).length
	return hits / targetTokens.length
}

const grammarShortWords = new Set([
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

function levenshtein(a: string, b: string) {
	const rows = Array.from({ length: a.length + 1 }, (_, i) => [i])
	for (let j = 1; j <= b.length; j += 1) rows[0][j] = j

	for (let i = 1; i <= a.length; i += 1) {
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			rows[i][j] = Math.min(
				rows[i - 1][j] + 1,
				rows[i][j - 1] + 1,
				rows[i - 1][j - 1] + cost
			)
		}
	}

	return rows[a.length][b.length]
}

function findSpellingIssues(answer: string, target: string) {
	const answerTokens = answer.split(' ').filter(Boolean)
	const targetTokens = target.split(' ').filter(Boolean)
	if (answerTokens.length !== targetTokens.length) return []

	const issues: { answer: string; correction: string }[] = []
	for (let index = 0; index < targetTokens.length; index += 1) {
		const answerToken = answerTokens[index]
		const targetToken = targetTokens[index]
		if (answerToken === targetToken) continue
		const editDistance = levenshtein(answerToken, targetToken)
		const canTreatAsSpelling =
			targetToken.length >= 6 &&
			editDistance <= 2 &&
			!grammarShortWords.has(targetToken)
		if (!canTreatAsSpelling) return []
		issues.push({ answer: answerToken, correction: targetToken })
	}

	return issues
}

export function evaluateAnswer(
	exercise: Exercise,
	rawAnswer: string,
	hintsUsed: number,
	msUsed: number
): EvaluationResult {
	const normalisedAnswer = normaliseItalian(rawAnswer)
	const accepted = exercise.acceptedItalian.some(
		(answer) => normaliseItalian(answer) === normalisedAnswer
	)
	const target = normaliseItalian(exercise.targetItalian)
	const overlap = tokenOverlap(normalisedAnswer, target)
	const contentOverlap = contentTokenOverlap(normalisedAnswer, target)
	const spellingIssues = accepted ? [] : findSpellingIssues(normalisedAnswer, target)
	const spellingOnly = spellingIssues.length > 0 && overlap >= 0.82
	const close = !accepted && (overlap >= 0.72 || contentOverlap >= 0.72)
	const communicative = accepted || spellingOnly || close || contentOverlap >= 0.62
	const fastEnough = msUsed < 25000
	const noHints = hintsUsed === 0
	const repairPrompts = exercise.repairPrompts?.length
		? exercise.repairPrompts
		: [exercise.promptEnglish]
	const base = {
		correctedItalian: exercise.targetItalian,
		meaning: exercise.promptEnglish,
		repairPrompts,
	}

	if (spellingOnly) {
		return {
			accepted: true,
			communicative: true,
			close: true,
			spellingOnly,
			outcome: 'hard',
			normalisedAnswer,
			message: 'Accepted with spelling repair.',
			shortFeedback: 'Good enough to say. Fix the spelling next.',
			errorTags: ['spelling'],
			spellingIssues,
			confidence: 0.86,
			...base,
		}
	}

	if (accepted && fastEnough && noHints) {
		return {
			accepted,
			communicative: true,
			close,
			spellingOnly,
			outcome: 'easy',
			normalisedAnswer,
			message: 'Fluent and accurate.',
			shortFeedback: 'Fast, clear, and accurate.',
			errorTags: [],
			spellingIssues,
			confidence: 0.98,
			...base,
		}
	}

	if (accepted) {
		return {
			accepted,
			communicative: true,
			close,
			spellingOnly,
			outcome: hintsUsed > 0 || msUsed > 45000 ? 'hard' : 'good',
			normalisedAnswer,
			message: hintsUsed > 0 ? 'Correct with support.' : 'Correct.',
			shortFeedback:
				hintsUsed > 0 || msUsed > 45000
					? 'Accurate. Now make it easier to retrieve.'
					: 'Accurate and usable.',
			errorTags: [],
			spellingIssues,
			confidence: hintsUsed > 0 ? 0.9 : 0.95,
			...base,
		}
	}

	if (communicative) {
		return {
			accepted,
			communicative,
			close: true,
			spellingOnly,
			outcome: 'hard',
			normalisedAnswer,
			message: 'Communicative. Polish it once.',
			shortFeedback: 'The idea would probably land. Use the model to tighten it.',
			errorTags: exercise.tags.slice(0, 2),
			spellingIssues,
			confidence: close ? 0.78 : 0.68,
			...base,
		}
	}

	return {
		accepted,
		communicative: false,
		close,
		spellingOnly,
		outcome: 'again',
		normalisedAnswer,
		message: close
			? 'Very close. Compare the model and repair it once.'
			: 'Not yet. Use the model sentence, then it will return in Mistake Gym.',
		shortFeedback: 'Not usable yet, but this is exactly what repair practice is for.',
		errorTags: exercise.tags,
		spellingIssues,
		confidence: 0.42,
		...base,
	}
}

export function outcomeIsCorrect(outcome: ExerciseOutcome) {
	return outcome === 'easy' || outcome === 'good' || outcome === 'hard'
}

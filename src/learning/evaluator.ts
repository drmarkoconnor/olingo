import type { Exercise } from '@/learning/content'

export type ExerciseOutcome = 'again' | 'hard' | 'good' | 'easy'

export type EvaluationResult = {
	accepted: boolean
	close: boolean
	spellingOnly: boolean
	outcome: ExerciseOutcome
	normalisedAnswer: string
	message: string
	errorTags: string[]
	spellingIssues: { answer: string; correction: string }[]
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
	const spellingIssues = accepted ? [] : findSpellingIssues(normalisedAnswer, target)
	const spellingOnly = spellingIssues.length > 0 && overlap >= 0.82
	const close = !accepted && overlap >= 0.72
	const fastEnough = msUsed < 25000
	const noHints = hintsUsed === 0

	if (spellingOnly) {
		return {
			accepted: true,
			close: true,
			spellingOnly,
			outcome: 'hard',
			normalisedAnswer,
			message: 'Accepted with spelling repair.',
			errorTags: ['spelling'],
			spellingIssues,
		}
	}

	if (accepted && fastEnough && noHints) {
		return {
			accepted,
			close,
			spellingOnly,
			outcome: 'easy',
			normalisedAnswer,
			message: 'Fluent and accurate.',
			errorTags: [],
			spellingIssues,
		}
	}

	if (accepted) {
		return {
			accepted,
			close,
			spellingOnly,
			outcome: hintsUsed > 0 || msUsed > 45000 ? 'hard' : 'good',
			normalisedAnswer,
			message: hintsUsed > 0 ? 'Correct with support.' : 'Correct.',
			errorTags: [],
			spellingIssues,
		}
	}

	return {
		accepted,
		close,
		spellingOnly,
		outcome: 'again',
		normalisedAnswer,
		message: close
			? 'Very close. Compare the model and repair it once.'
			: 'Not yet. Use the model sentence, then it will return in Mistake Gym.',
		errorTags: exercise.tags,
		spellingIssues,
	}
}

export function outcomeIsCorrect(outcome: ExerciseOutcome) {
	return outcome === 'easy' || outcome === 'good' || outcome === 'hard'
}

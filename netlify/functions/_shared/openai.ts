import { getEnv } from './env'
import type { StructuredEvaluation } from './evaluate'

const evaluationSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		accepted: { type: 'boolean' },
		communicative: { type: 'boolean' },
		correctedItalian: { type: 'string' },
		meaning: { type: 'string' },
		errorTags: { type: 'array', items: { type: 'string' } },
		shortFeedback: { type: 'string' },
		repairPrompts: { type: 'array', items: { type: 'string' } },
		confidence: { type: 'number' },
	},
	required: [
		'accepted',
		'communicative',
		'correctedItalian',
		'meaning',
		'errorTags',
		'shortFeedback',
		'repairPrompts',
		'confidence',
	],
} as const

function outputText(data: any) {
	if (typeof data.output_text === 'string') return data.output_text
	const text = data.output
		?.flatMap((item: any) => item.content ?? [])
		?.find((content: any) => content.type === 'output_text')?.text
	return typeof text === 'string' ? text : ''
}

export async function evaluateWithOpenAI(payload: unknown) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) return null

	const model = getEnv('OPENAI_MODEL') || 'gpt-5.4-mini'
	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			store: false,
			input: [
				{
					role: 'system',
					content:
						'You evaluate a short spoken-style Italian learner response at the requested CEFR level and session focus. Judge whether an Italian listener would understand the intended meaning before judging polish. Accept natural alternatives that preserve the prompt meaning; do not demand the model wording. If communicative but imperfect, say so kindly and correct only the highest-value issue. Check person, number, tense, modality, and time relationships carefully. Keep feedback brief enough for live conversation practice. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify(payload),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_answer_evaluation',
					strict: true,
					schema: evaluationSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		return JSON.parse(text) as StructuredEvaluation
	} catch {
		return null
	}
}

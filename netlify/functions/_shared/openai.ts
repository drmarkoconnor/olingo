import { getEnv } from './env'
import { isSemanticAssessment } from '../../../src/learning/assessment-contract'

const evaluationSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		exerciseValid: { type: 'boolean' },
		invalidReason: { type: 'string' },
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
		'exerciseValid',
		'invalidReason',
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
	try {
		const response = await fetch('https://api.openai.com/v1/responses', {
			signal: AbortSignal.timeout(25_000),
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
							'You evaluate an Italian learner response at the requested CEFR level and session focus. First identify exercise.evaluationMode. Audit whether the visible prompt, requested action and speaker context describe a coherent conversational turn. In open-goal mode the model target is illustrative: differences from its personal opinion, choice or invented detail are not exercise defects. In meaning mode the target must also agree with the intended prompt meaning. If they conflict, are unrelated, or leave the required meaning hidden, set exerciseValid=false, explain the defect briefly in invalidReason, and do not blame the learner. Otherwise set exerciseValid=true and invalidReason to an empty string. For a valid exercise, judge whether an Italian listener would understand the intended meaning before judging polish. For evaluationMode=open-goal, assess the stated communicative goal and scenario constraints; the model target is only one illustrative answer, not a required personal opinion, choice, fact or wording. Accept different truthful or plausible choices and viewpoints that fulfil the requested task. Only facts or positions explicitly required by the visible instruction or scenario are binding; details found solely in the example are optional. Do not invent a truth check on the learner\'s personal experience. Correct language while preserving the learner\'s intended viewpoint. For other exercises, accept natural alternatives that preserve the prompt meaning. Do not demand the model wording. When accepting an answer, retain the learner\'s own wording in correctedItalian rather than substituting your preferred formulation. If communicative but imperfect, say so kindly and correct only the highest-value issue. Check person, number, tense, modality, register, and time relationships carefully. Keep feedback brief enough for live conversation practice. Return only schema-valid JSON.',
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
		const parsed: unknown = JSON.parse(text)
		return isSemanticAssessment(parsed) ? parsed : null
	} catch {
		return null
	}
}

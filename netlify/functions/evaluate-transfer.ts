import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { normalise } from './_shared/evaluate'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type SourceItem = {
	id?: string
	sourceName?: string
	title?: string
	topic?: string
	summary?: string
	prompt?: string
}

type Body = {
	sourceItem?: SourceItem
	answer?: string
	level?: string
	programWeek?: number
}

type TransferEvaluation = {
	accepted: boolean
	communicative: boolean
	correctedItalian: string
	meaning: string
	errorTags: string[]
	shortFeedback: string
	repairPrompts: string[]
	confidence: number
	grammarScore: number
	complexityScore: number
}

const transferSchema = {
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
		grammarScore: { type: 'number' },
		complexityScore: { type: 'number' },
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
		'grammarScore',
		'complexityScore',
	],
} as const

function outputText(data: any) {
	if (typeof data.output_text === 'string') return data.output_text
	const text = data.output
		?.flatMap((item: any) => item.content ?? [])
		?.find((content: any) => content.type === 'output_text')?.text
	return typeof text === 'string' ? text : ''
}

function clampScore(value: number) {
	if (!Number.isFinite(value)) return 0
	return Math.max(0, Math.min(100, Math.round(value)))
}

function fallbackEvaluation(answer: string, sourceItem?: SourceItem): TransferEvaluation {
	const normalised = normalise(answer)
	const tokens = normalised.split(' ').filter(Boolean)
	const italianSignals = [
		'ho',
		'e',
		'che',
		'questa',
		'questo',
		'secondo',
		'me',
		'sembra',
		'penso',
		'perche',
	]
	const signalHits = italianSignals.filter((token) => tokens.includes(token)).length
	const grammarScore = clampScore(35 + signalHits * 8 + Math.min(tokens.length, 12) * 3)
	const complexityScore = clampScore(
		25 + Math.min(tokens.length, 18) * 3 + (tokens.includes('perche') ? 12 : 0)
	)
	const communicative = tokens.length >= 4 && signalHits >= 1
	const correctedItalian = communicative
		? answer.trim()
		: `Ho visto ${sourceItem?.title ?? 'questa notizia'} e mi sembra interessante.`

	return {
		accepted: communicative && grammarScore >= 75,
		communicative,
		correctedItalian,
		meaning: sourceItem?.prompt ?? sourceItem?.title ?? 'A response to the source.',
		errorTags: communicative ? [] : ['source-response', 'sentence-formation'],
		shortFeedback: communicative
			? 'Usable as a source response. Add one reason if you want to stretch it.'
			: 'Make it one complete Italian sentence about the clip or article.',
		repairPrompts: [
			`Say one sentence about: ${sourceItem?.title ?? 'the source'}`,
			'Add one reason with perche.',
		],
		confidence: communicative ? 0.62 : 0.35,
		grammarScore,
		complexityScore,
	}
}

async function assessWithOpenAI(payload: {
	sourceItem?: SourceItem
	answer: string
	level?: string
	programWeek?: number
	fallback: TransferEvaluation
}) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) return null

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: getEnv('OPENAI_MODEL') || 'gpt-5.4-mini',
			store: false,
			input: [
				{
					role: 'system',
					content:
						'You assess one open-ended Italian learner sentence written after watching or reading a source. Judge communicative adequacy, grammar, and complexity for the learner level. Be kind, concise, and practical. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify(payload),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_transfer_evaluation',
					strict: true,
					schema: transferSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		const parsed = JSON.parse(text) as TransferEvaluation
		return {
			...parsed,
			grammarScore: clampScore(parsed.grammarScore),
			complexityScore: clampScore(parsed.complexityScore),
			confidence: Math.max(0, Math.min(1, parsed.confidence)),
		}
	} catch {
		return null
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	const answer = body?.answer?.trim() ?? ''
	if (!answer) return json({ error: 'Missing transfer sentence' }, { status: 400 })

	const fallback = fallbackEvaluation(answer, body?.sourceItem)
	const ai = await assessWithOpenAI({
		sourceItem: body?.sourceItem,
		answer,
		level: body?.level,
		programWeek: body?.programWeek,
		fallback,
	})
	const result = ai ?? fallback

	const store = getStore({ name: 'transfer-ledger' })
	await store.setJSON(
		`users/${encodeURIComponent(auth.user.id)}/${new Date().toISOString()}-${
			body?.sourceItem?.id ?? 'source'
		}`,
		{
			userId: auth.user.id,
			sourceItem: body?.sourceItem ?? null,
			answer,
			result,
			provider: ai ? 'openai' : 'deterministic',
		}
	)

	return json({ ...result, provider: ai ? 'openai' : 'deterministic' })
}

export const config = {
	path: '/api/evaluate-transfer',
}

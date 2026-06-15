import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { normalise } from './_shared/evaluate'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed } from './_shared/http'

type PronunciationFeedback = {
	transcript: string
	intelligibilityScore: number
	passageCoverage: number
	rhythmScore: number
	problemSounds: string[]
	missedWords: string[]
	substitutions: Array<{ expected: string; heard: string }>
	shortFeedback: string
	practiceLines: string[]
}

const pronunciationSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		transcript: { type: 'string' },
		intelligibilityScore: { type: 'number' },
		passageCoverage: { type: 'number' },
		rhythmScore: { type: 'number' },
		problemSounds: { type: 'array', items: { type: 'string' } },
		missedWords: { type: 'array', items: { type: 'string' } },
		substitutions: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					expected: { type: 'string' },
					heard: { type: 'string' },
				},
				required: ['expected', 'heard'],
			},
		},
		shortFeedback: { type: 'string' },
		practiceLines: { type: 'array', items: { type: 'string' } },
	},
	required: [
		'transcript',
		'intelligibilityScore',
		'passageCoverage',
		'rhythmScore',
		'problemSounds',
		'missedWords',
		'substitutions',
		'shortFeedback',
		'practiceLines',
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

function tokenise(value: string) {
	return normalise(value).split(' ').filter(Boolean)
}

function deterministicFeedback(
	expectedText: string,
	transcript: string
): PronunciationFeedback {
	const expectedTokens = tokenise(expectedText)
	const heardTokens = tokenise(transcript)
	const heardSet = new Set(heardTokens)
	const missedWords = expectedTokens
		.filter((token) => !heardSet.has(token))
		.slice(0, 8)
	const coverage = expectedTokens.length
		? ((expectedTokens.length - missedWords.length) / expectedTokens.length) * 100
		: 0
	const lengthPenalty = Math.min(
		28,
		Math.abs(expectedTokens.length - heardTokens.length) * 4
	)
	const score = clampScore(coverage - lengthPenalty)
	const rhythmScore = clampScore(100 - lengthPenalty)

	return {
		transcript,
		intelligibilityScore: score,
		passageCoverage: clampScore(coverage),
		rhythmScore,
		problemSounds: score >= 80 ? [] : ['pronunciation', 'word-shape'],
		missedWords,
		substitutions: [],
		shortFeedback:
			score >= 80
				? 'Clear enough to use. Repeat once with the same steady rhythm.'
				: 'The reading partly landed. Slow down, keep the vowel endings clear, then try the line again.',
		practiceLines: [
			expectedTokens.slice(0, Math.ceil(expectedTokens.length / 2)).join(' '),
			expectedTokens.slice(Math.ceil(expectedTokens.length / 2)).join(' '),
		].filter(Boolean),
	}
}

async function transcribeAudio(audio: File, apiKey: string) {
	const form = new FormData()
	form.append('file', audio)
	form.append(
		'model',
		getEnv('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe'
	)
	form.append('language', 'it')
	form.append('response_format', 'json')

	const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
		body: form,
	})
	if (!response.ok) return ''
	const data = (await response.json()) as { text?: string }
	return data.text ?? ''
}

async function assessWithOpenAI(payload: {
	expectedText: string
	passageId: string
	transcript: string
	fallback: PronunciationFeedback
}) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey || !payload.transcript) return null

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: getEnv('OPENAI_PRONUNCIATION_MODEL') || getEnv('OPENAI_MODEL') || 'gpt-5.4-mini',
			store: false,
			input: [
				{
					role: 'system',
					content:
						'You assess an Italian learner reading a known passage. Be kind and practical. Judge intelligibility and coverage from the transcript, not accent perfection. Return only schema-valid JSON.',
				},
				{
					role: 'user',
					content: JSON.stringify(payload),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_pronunciation_feedback',
					strict: true,
					schema: pronunciationSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		const parsed = JSON.parse(text) as PronunciationFeedback
		return {
			...parsed,
			transcript: parsed.transcript || payload.transcript,
			intelligibilityScore: clampScore(parsed.intelligibilityScore),
			passageCoverage: clampScore(parsed.passageCoverage),
			rhythmScore: clampScore(parsed.rhythmScore),
		}
	} catch {
		return null
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const form = await req.formData()
	const audio = form.get('audio')
	const passageId = String(form.get('passageId') || 'passage')
	const expectedText = String(form.get('expectedText') || '')
	if (!(audio instanceof File) || !expectedText.trim()) {
		return json({ error: 'Missing audio or expected text' }, { status: 400 })
	}
	if (audio.size > 10 * 1024 * 1024) {
		return json({ error: 'Audio recording is too large' }, { status: 413 })
	}

	const apiKey = getEnv('OPENAI_API_KEY')
	const transcript = apiKey ? await transcribeAudio(audio, apiKey) : ''
	const fallback = deterministicFeedback(expectedText, transcript)
	const ai = await assessWithOpenAI({
		expectedText,
		passageId,
		transcript,
		fallback,
	})
	const result = ai ?? fallback
	const payload = {
		...result,
		provider: ai ? 'openai' : 'deterministic',
		passageId,
		createdAt: new Date().toISOString(),
	}

	const store = getStore({ name: 'pronunciation-ledger' })
	await store.setJSON(
		`users/${encodeURIComponent(auth.user.id)}/${payload.createdAt}-${encodeURIComponent(passageId)}`,
		{
			userId: auth.user.id,
			...payload,
		}
	)

	return json(payload)
}

export const config = {
	path: '/api/pronunciation-assessment',
}

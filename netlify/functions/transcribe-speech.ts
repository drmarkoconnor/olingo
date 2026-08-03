import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed } from './_shared/http'

function keyConfigurationError(apiKey: string | undefined) {
	const value = apiKey?.trim()
	if (!value) return 'OpenAI transcription is not configured for this deployment.'
	if (value.startsWith('OPENAI_API_KEY') || !value.startsWith('sk-')) {
		return 'OPENAI_API_KEY must contain the actual OpenAI key value only.'
	}
	return null
}

function failureMessage(status: number) {
	if (status === 401) return 'OpenAI rejected the transcription key.'
	if (status === 429) return 'OpenAI transcription has reached its current rate or quota limit.'
	return `OpenAI transcription is temporarily unavailable (${status}).`
}

export default async (req: Request) => {
	try {
		if (req.method !== 'POST') return methodNotAllowed()
		const auth = await requireUser()
		if (authFailed(auth)) return auth.response

		const form = await req.formData()
		const audio = form.get('audio')
		if (!(audio instanceof File)) {
			return json({ error: 'Missing audio recording' }, { status: 400 })
		}
		if (audio.size > 10 * 1024 * 1024) {
			return json({ error: 'Audio recording is too large' }, { status: 413 })
		}

		const apiKey = getEnv('OPENAI_API_KEY')?.trim()
		const configError = keyConfigurationError(apiKey)
		if (configError || !apiKey) {
			return json({ error: configError }, { status: 503 })
		}

		const context = String(form.get('context') || '').slice(0, 300)
		const skillId = String(form.get('skillId') || 'speech').slice(0, 120)
		const responseLatencyMs = Math.max(
			0,
			Math.round(Number(form.get('responseLatencyMs')) || 0)
		)
		const utteranceDurationMs = Math.max(
			0,
			Math.round(Number(form.get('utteranceDurationMs')) || 0)
		)
		const transcriptionForm = new FormData()
		transcriptionForm.append('file', audio)
		transcriptionForm.append(
			'model',
			getEnv('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe'
		)
		transcriptionForm.append('language', 'it')
		transcriptionForm.append('response_format', 'json')
		transcriptionForm.append(
			'prompt',
			`Conversational Italian. Preserve the learner's actual words and errors. General context: ${context}`
		)

		const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}` },
			body: transcriptionForm,
		})
		if (!response.ok) {
			return json({ error: failureMessage(response.status) }, { status: 502 })
		}
		const data = (await response.json()) as { text?: string }
		const transcript = data.text?.trim() ?? ''
		if (!transcript) {
			return json(
				{ error: 'I could not hear a clear Italian response. Please try once more.' },
				{ status: 422 }
			)
		}

		const createdAt = new Date().toISOString()
		const store = getStore({ name: 'speech-attempts' })
		await store.setJSON(
			`users/${encodeURIComponent(auth.user.id)}/${createdAt}-${encodeURIComponent(skillId)}`,
			{
				userId: auth.user.id,
				skillId,
				transcript,
				responseLatencyMs,
				utteranceDurationMs,
				createdAt,
			}
		)

		return json({
			transcript,
			provider: 'openai',
			responseLatencyMs,
			utteranceDurationMs,
		})
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		)
	}
}

export const config = {
	path: '/api/transcribe-speech',
}

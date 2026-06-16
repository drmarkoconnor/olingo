import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type Body = {
	text?: string
}

function cleanText(value: unknown) {
	if (typeof value !== 'string') return ''
	return value.replace(/\s+/g, ' ').trim().slice(0, 800)
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) {
		return json(
			{ error: 'OpenAI API key is not configured for speech.' },
			{ status: 503 }
		)
	}

	const body = await readJson<Body>(req)
	const text = cleanText(body?.text)
	if (!text) return json({ error: 'Missing text' }, { status: 400 })

	const response = await fetch('https://api.openai.com/v1/audio/speech', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: getEnv('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
			voice: getEnv('OPENAI_TTS_VOICE') || 'marin',
			input: text,
			instructions:
				'Speak as a native Italian speaker from Italy. Use clear, natural Italian pronunciation, steady learner-friendly pace, and do not anglicise vowels or consonants.',
		}),
	})

	if (!response.ok) {
		return json(
			{ error: 'Italian speech generation failed' },
			{ status: response.status }
		)
	}

	return new Response(await response.arrayBuffer(), {
		headers: {
			'Cache-Control': 'private, max-age=3600',
			'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
		},
	})
}

export const config = {
	path: '/api/italian-tts',
}

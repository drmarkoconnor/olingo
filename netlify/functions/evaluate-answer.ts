import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { deterministicEvaluation } from './_shared/evaluate'
import { evaluateWithOpenAI } from './_shared/openai'
import { json, methodNotAllowed, readJson } from './_shared/http'

type Body = {
	exercise?: {
		id?: string
		promptEnglish: string
		targetItalian: string
		acceptedItalian?: string[]
		tags?: string[]
		repairPrompts?: string[]
		action?: string
		communicativeGoal?: string
		communicativeFunction?: string
		npcLine?: string
	}
	answer?: string
	context?: {
		spokenFirst?: boolean
		phase?: string
		action?: string
		level?: string
		focus?: string
		cueMode?: string
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body?.exercise || typeof body.answer !== 'string') {
		return json({ error: 'Missing exercise or answer' }, { status: 400 })
	}

	const fallback = deterministicEvaluation(body.exercise, body.answer)
	const ai = await evaluateWithOpenAI({
		exercise: body.exercise,
		answer: body.answer,
		context: body.context,
		fallback,
	})
	const result = ai ?? fallback

	if (result.exerciseValid !== false && !result.accepted) {
		const store = getStore({ name: 'mistake-ledger' })
		const key = `users/${encodeURIComponent(auth.user.id)}/${new Date().toISOString()}-${
			body.exercise.id ?? 'exercise'
		}`
		await store.setJSON(key, {
			userId: auth.user.id,
			exerciseId: body.exercise.id,
			answer: body.answer,
			result,
			context: body.context,
		})
	}

	return json({ ...result, provider: ai ? 'openai' : 'deterministic' })
}

export const config = {
	path: '/api/evaluate-answer',
}

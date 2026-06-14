import { getStore } from '@netlify/blobs'
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
	}
	answer?: string
	context?: {
		spokenFirst?: boolean
		phase?: string
		action?: string
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
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

	if (!result.accepted) {
		const store = getStore({ name: 'mistake-ledger' })
		const key = `${new Date().toISOString()}-${body.exercise.id ?? 'exercise'}`
		await store.setJSON(key, {
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

import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { json, methodNotAllowed, readJson } from './_shared/http'

type Body = {
	mistake?: {
		id?: string
		promptEnglish: string
		correctedItalian: string
		tags?: string[]
	}
}

function drills(body: Body) {
	const mistake = body.mistake!
	const tags = mistake.tags ?? []
	const focus = tags[0] ?? 'sentence shape'
	return [
		{
			promptEnglish: mistake.promptEnglish,
			targetItalian: mistake.correctedItalian,
			phase: 'repair',
			action: 'Repair',
			focus,
		},
		{
			promptEnglish: `Say the same idea again, changing one small detail.`,
			targetItalian: mistake.correctedItalian,
			phase: 'repair',
			action: 'Transform',
			focus,
		},
		{
			promptEnglish: `Say a shorter version you could use in conversation.`,
			targetItalian: mistake.correctedItalian,
			phase: 'speak',
			action: 'Say aloud',
			focus,
		},
	]
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body?.mistake) return json({ error: 'Missing mistake' }, { status: 400 })
	const pack = {
		id: body.mistake.id ?? crypto.randomUUID(),
		drills: drills(body),
		createdAt: new Date().toISOString(),
	}
	const store = getStore({ name: 'generated-packs' })
	await store.setJSON(`users/${encodeURIComponent(auth.user.id)}/repairs/${pack.id}`, pack)
	return json(pack)
}

export const config = {
	path: '/api/generate-repair-drills',
}

import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { json, methodNotAllowed, readJson } from './_shared/http'

type Body = {
	snapshot?: unknown
}

function keyFor(userId: string) {
	return `users/${encodeURIComponent(userId)}/latest`
}

export default async (req: Request) => {
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const userId = auth.user.id
	const store = getStore({ name: 'progress-snapshots', consistency: 'strong' })

	if (req.method === 'GET') {
		const snapshot = await store.get(keyFor(userId), { type: 'json' })
		return json({ snapshot: snapshot ?? null })
	}

	if (req.method === 'POST') {
		const body = await readJson<Body>(req)
		if (!body || typeof body.snapshot === 'undefined') {
			return json({ error: 'Missing snapshot' }, { status: 400 })
		}
		const payload = {
			userId,
			snapshot: body.snapshot,
			updatedAt: new Date().toISOString(),
		}
		await store.setJSON(keyFor(userId), payload)
		return json(payload)
	}

	return methodNotAllowed()
}

export const config = {
	path: '/api/progress-snapshot',
}

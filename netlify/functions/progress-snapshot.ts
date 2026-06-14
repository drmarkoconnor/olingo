import { getStore } from '@netlify/blobs'
import { json, methodNotAllowed, readJson } from './_shared/http'

type Body = {
	userId?: string
	snapshot?: unknown
}

function keyFor(userId: string) {
	return `users/${encodeURIComponent(userId)}/latest`
}

export default async (req: Request) => {
	const url = new URL(req.url)
	const userId = url.searchParams.get('userId')
	const store = getStore({ name: 'progress-snapshots', consistency: 'strong' })

	if (req.method === 'GET') {
		if (!userId) return json({ error: 'Missing userId' }, { status: 400 })
		const snapshot = await store.get(keyFor(userId), { type: 'json' })
		return json({ snapshot: snapshot ?? null })
	}

	if (req.method === 'POST') {
		const body = await readJson<Body>(req)
		if (!body?.userId || !body.snapshot) {
			return json({ error: 'Missing userId or snapshot' }, { status: 400 })
		}
		const payload = {
			userId: body.userId,
			snapshot: body.snapshot,
			updatedAt: new Date().toISOString(),
		}
		await store.setJSON(keyFor(body.userId), payload)
		return json(payload)
	}

	return methodNotAllowed()
}

export const config = {
	path: '/api/progress-snapshot',
}

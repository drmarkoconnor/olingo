import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { json, methodNotAllowed } from './_shared/http'

const kinds = ['sentences', 'pronunciation', 'vocabulary'] as const
type LibraryKind = (typeof kinds)[number]

function isKind(value: string | null): value is LibraryKind {
	return kinds.includes(value as LibraryKind)
}

export default async (req: Request) => {
	if (req.method !== 'GET') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const url = new URL(req.url)
	const kind = url.searchParams.get('kind')
	const level = url.searchParams.get('level')
	if (!isKind(kind)) return json({ error: 'Unknown library kind' }, { status: 400 })

	const store = getStore({ name: 'generated-packs', consistency: 'strong' })
	const prefix = `users/${encodeURIComponent(auth.user.id)}/${kind}/`
	const listed = await store.list({ prefix })
	const keys = listed.blobs
		.map((blob) => blob.key)
		.sort((a, b) => b.localeCompare(a))
		.slice(0, 24)
	const packs = (
		await Promise.all(keys.map((key) => store.get(key, { type: 'json' })))
	).filter(
		(pack): pack is Record<string, unknown> =>
			Boolean(pack) && (!level || String((pack as Record<string, unknown>).level) === level)
	)

	return json({ kind, level, packs })
}

export const config = {
	path: '/api/generated-library',
}

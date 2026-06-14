export function json(data: unknown, init: ResponseInit = {}) {
	return Response.json(data, {
		...init,
		headers: {
			'Cache-Control': 'no-store',
			...(init.headers ?? {}),
		},
	})
}

export function methodNotAllowed() {
	return json({ error: 'Method not allowed' }, { status: 405 })
}

export async function readJson<T>(req: Request) {
	try {
		return (await req.json()) as T
	} catch {
		return null
	}
}

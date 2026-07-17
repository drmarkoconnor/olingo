import { authFailed, requireUser } from './_shared/auth'
import { methodNotAllowed } from './_shared/http'

export default async (req: Request) => {
	if (req.method !== 'GET') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response
	return Response.json({
		user: {
			id: auth.user.id,
			email: auth.user.email ?? null,
			name: auth.user.name ?? null,
		},
	})
}

export const config = {
	path: '/api/session',
}

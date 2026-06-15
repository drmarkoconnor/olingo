import { getUser, type User } from '@netlify/identity'
import { json } from './http'

type AuthResult = { user: User } | { response: Response }

export async function requireUser(): Promise<AuthResult> {
	const user = await getUser()
	if (!user) {
		return {
			response: json(
				{ error: 'Unauthorized', message: 'Please sign in to use Olingo.' },
				{ status: 401 }
			),
		}
	}
	return { user }
}

export function authFailed(result: AuthResult): result is { response: Response } {
	return 'response' in result
}

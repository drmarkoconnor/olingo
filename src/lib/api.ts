import { refreshSession } from '@netlify/identity'

export const authExpiredEvent = 'olingo:auth-expired'

function requestInput(input: RequestInfo | URL) {
	return input instanceof Request ? input.clone() : input
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
	const requestInit = {
		...init,
		credentials: init.credentials ?? 'include',
	} satisfies RequestInit
	const first = await fetch(requestInput(input), requestInit)
	if (first.status !== 401 || typeof window === 'undefined') return first

	const refreshed = await refreshSession().catch(() => null)
	if (refreshed) {
		const retry = await fetch(requestInput(input), requestInit)
		if (retry.status !== 401) return retry
		window.dispatchEvent(new CustomEvent(authExpiredEvent))
		return retry
	}

	window.dispatchEvent(new CustomEvent(authExpiredEvent))
	return first
}

export function friendlyApiError(
	status: number,
	message: string | undefined,
	fallback: string
) {
	if (status === 401) {
		return 'Your login session was not available for this check, so use the unscored finish button or refresh and sign in again.'
	}
	return message || fallback
}

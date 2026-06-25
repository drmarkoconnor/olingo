export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
	return fetch(input, {
		...init,
		credentials: init.credentials ?? 'include',
	})
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

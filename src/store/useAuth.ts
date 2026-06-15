import {
	acceptInvite,
	getUser,
	handleAuthCallback,
	login,
	logout,
	oauthLogin,
	onAuthChange,
	type User,
} from '@netlify/identity'
import { create } from 'zustand'

type AuthState = {
	userId: string
	email?: string | null
	name?: string | null
	loading: boolean
	ready: boolean
	authenticated: boolean
	localMode: boolean
	inviteToken?: string | null
	error?: string | null
	signInWithEmail: (email: string, password: string) => Promise<void>
	signInWithGoogle: () => Promise<void>
	acceptInvitePassword: (password: string) => Promise<void>
	signOut: () => Promise<void>
	refreshSession: () => Promise<void>
	clearError: () => void
}

const LOCAL_UID_KEY = 'olingo.localUid'
const localMode =
	import.meta.env.DEV && import.meta.env.VITE_REQUIRE_AUTH !== 'true'

function errorMessage(error: unknown) {
	if (error instanceof Error) return error.message
	return String(error || 'Something went wrong')
}

function getOrCreateLocalUserId() {
	if (typeof window === 'undefined') return 'local-dev'
	const existing = window.localStorage.getItem(LOCAL_UID_KEY)
	if (existing) return existing
	const next = `local-${crypto.randomUUID()}`
	window.localStorage.setItem(LOCAL_UID_KEY, next)
	return next
}

function authenticatedState(user: User): Partial<AuthState> {
	return {
		userId: user.id,
		email: user.email ?? null,
		name: user.name ?? null,
		authenticated: true,
		loading: false,
		ready: true,
		inviteToken: null,
		error: null,
	}
}

function localState(): Partial<AuthState> {
	return {
		userId: getOrCreateLocalUserId(),
		email: null,
		name: 'Local practice',
		authenticated: true,
		loading: false,
		ready: true,
		localMode: true,
		inviteToken: null,
		error: null,
	}
}

function signedOutState(error?: string | null): Partial<AuthState> {
	return {
		userId: 'signed-out',
		email: null,
		name: null,
		authenticated: false,
		loading: false,
		ready: true,
		localMode: false,
		inviteToken: null,
		error,
	}
}

export const useAuth = create<AuthState>((set, get) => ({
	userId: localMode ? getOrCreateLocalUserId() : 'loading',
	email: null,
	name: localMode ? 'Local practice' : null,
	loading: !localMode,
	ready: localMode,
	authenticated: localMode,
	localMode,
	inviteToken: null,
	error: null,

	signInWithEmail: async (email, password) => {
		set({ loading: true, error: null })
		try {
			const user = await login(email.trim(), password)
			set(authenticatedState(user))
		} catch (error) {
			set({ loading: false, ready: true, error: errorMessage(error) })
		}
	},

	signInWithGoogle: async () => {
		set({ error: null })
		try {
			oauthLogin('google')
		} catch (error) {
			set({ error: errorMessage(error) })
		}
	},

	acceptInvitePassword: async (password) => {
		const token = get().inviteToken
		if (!token) {
			set({ error: 'This invite link is missing its token.' })
			return
		}
		set({ loading: true, error: null })
		try {
			const user = await acceptInvite(token, password)
			set(authenticatedState(user))
		} catch (error) {
			set({ loading: false, ready: true, error: errorMessage(error) })
		}
	},

	signOut: async () => {
		if (localMode) {
			set(localState())
			return
		}
		set({ loading: true, error: null })
		try {
			await logout()
		} catch (error) {
			set({ error: errorMessage(error) })
		} finally {
			set(signedOutState(null))
		}
	},

	refreshSession: async () => {
		if (localMode) {
			set(localState())
			return
		}
		set({ loading: true, error: null })
		try {
			const callback = await handleAuthCallback()
			if (callback?.type === 'invite' && callback.token) {
				set({
					...signedOutState(null),
					inviteToken: callback.token,
				})
				return
			}
			if (callback?.user) {
				set(authenticatedState(callback.user))
				return
			}
			const user = await getUser()
			set(user ? authenticatedState(user) : signedOutState(null))
		} catch (error) {
			set(signedOutState(errorMessage(error)))
		}
	},

	clearError: () => set({ error: null }),
}))

if (typeof window !== 'undefined' && !localMode) {
	onAuthChange((_event, user) => {
		useAuth.setState(user ? authenticatedState(user) : signedOutState(null))
	})
}

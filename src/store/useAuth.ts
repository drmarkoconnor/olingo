import {
	acceptInvite, getSettings, getUser, handleAuthCallback, login, logout,
	oauthLogin, onAuthChange, refreshSession as refreshIdentitySession,
	requestPasswordRecovery, updateUser, type Settings, type User,
} from '@netlify/identity'
import { create } from 'zustand'
import { authExpiredEvent } from '@/lib/api'
import { switchSettingsUser } from '@/store/useSettings'

type AuthState = {
	userId: string
	email?: string | null
	name?: string | null
	loading: boolean
	ready: boolean
	authenticated: boolean
	serverVerified: boolean
	localMode: boolean
	inviteToken?: string | null
	passwordResetRequired: boolean
	identitySettings: Settings | null
	settingsError: string | null
	notice: string | null
	error?: string | null
	signInWithEmail: (email: string, password: string) => Promise<void>
	signInWithGoogle: () => Promise<void>
	acceptInvitePassword: (password: string) => Promise<void>
	requestReset: (email: string) => Promise<void>
	resetPassword: (password: string) => Promise<void>
	loadIdentitySettings: () => Promise<void>
	signOut: () => Promise<void>
	refreshSession: () => Promise<void>
	clearError: () => void
}

const LOCAL_UID_KEY = 'olingo.localUid'
const localMode = import.meta.env.DEV && import.meta.env.VITE_REQUIRE_AUTH !== 'true'
let authRevision = 0

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error || 'Something went wrong')
}
function getOrCreateLocalUserId() {
	if (typeof window === 'undefined') return 'local-dev'
	const existing = window.localStorage.getItem(LOCAL_UID_KEY)
	if (existing) return existing
	const next = `local-${crypto.randomUUID()}`
	window.localStorage.setItem(LOCAL_UID_KEY, next)
	return next
}
function signedOutState(error?: string | null): Partial<AuthState> {
	return { userId: 'signed-out', email: null, name: null, authenticated: false,
		serverVerified: false, loading: false, ready: true, localMode: false,
		inviteToken: null, passwordResetRequired: false, error }
}
function authenticatedState(user: User, serverVerified: boolean): Partial<AuthState> {
	return { userId: user.id, email: user.email ?? null, name: user.name ?? null,
		authenticated: true, serverVerified, loading: false, ready: true,
		inviteToken: null, error: null }
}
async function verifyServerSession(expectedUserId: string) {
	const check = () => fetch('/api/session', { credentials: 'include' })
	try {
		let response = await check()
		if (response.status === 401 && await refreshIdentitySession().catch(() => null)) response = await check()
		if (response.ok) {
			const session = await response.json() as { user?: { id?: string } }
			return session.user?.id === expectedUserId ? 'verified' as const : 'rejected' as const
		}
		return response.status === 401 ? 'rejected' as const : 'offline' as const
	} catch { return 'offline' as const }
}
function commitAuth(state: Partial<AuthState>) {
	if (state.userId) switchSettingsUser(state.authenticated ? state.userId : null)
	useAuth.setState(state)
}
async function receiveUser(user: User, resetRequired?: boolean) {
	const revision = ++authRevision
	const verification = await verifyServerSession(user.id)
	if (revision !== authRevision) return
	commitAuth(verification === 'rejected'
		? signedOutState('Your session expired. Please sign in again.')
		: { ...authenticatedState(user, verification === 'verified'),
			...(resetRequired === undefined ? {} : { passwordResetRequired: resetRequired }) })
}
const initialLocalId = localMode ? getOrCreateLocalUserId() : null
if (initialLocalId) switchSettingsUser(initialLocalId)

export const useAuth = create<AuthState>((set, get) => ({
	userId: initialLocalId ?? 'loading', email: null, name: localMode ? 'Local practice' : null,
	loading: !localMode, ready: localMode, authenticated: localMode, serverVerified: localMode,
	localMode, inviteToken: null, passwordResetRequired: false, identitySettings: null,
	settingsError: null, notice: null, error: null,
	loadIdentitySettings: async () => {
		try { set({ identitySettings: await getSettings(), settingsError: null }) }
		catch { set({ settingsError: 'Sign-in options could not be checked. Email sign-in remains available.' }) }
	},
	signInWithEmail: async (email, password) => {
		set({ loading: true, error: null, notice: null })
		try { await receiveUser(await login(email.trim(), password), false) }
		catch (error) { set({ loading: false, ready: true, error: errorMessage(error) }) }
	},
	signInWithGoogle: async () => {
		if (!get().identitySettings?.providers.google) {
			set({ error: 'Google sign-in is not enabled for this site. Use email and password.' })
			return
		}
		set({ error: null })
		try { oauthLogin('google') } catch (error) { set({ error: errorMessage(error) }) }
	},
	acceptInvitePassword: async (password) => {
		const token = get().inviteToken
		if (!token) { set({ error: 'This invite link is missing its token.' }); return }
		set({ loading: true, error: null })
		try { await receiveUser(await acceptInvite(token, password), false) }
		catch (error) { set({ loading: false, ready: true, error: errorMessage(error) }) }
	},
	requestReset: async (email) => {
		set({ loading: true, error: null, notice: null })
		try {
			await requestPasswordRecovery(email.trim())
			set({ notice: 'If this address has an account, check its inbox for a password reset link.' })
		} catch (error) { set({ error: errorMessage(error) }) }
		finally { set({ loading: false }) }
	},
	resetPassword: async (password) => {
		if (!get().passwordResetRequired) return
		set({ loading: true, error: null })
		try {
			const user = await updateUser({ password })
			await receiveUser(user, false)
			set({ notice: 'Your password has been updated.' })
		} catch (error) { set({ loading: false, error: errorMessage(error) }) }
	},
	signOut: async () => {
		if (localMode) return
		++authRevision
		commitAuth(signedOutState(null))
		try { await logout() }
		catch (error) { set({ error: errorMessage(error) }) }
	},
	refreshSession: async () => {
		if (localMode) { switchSettingsUser(get().userId); return }
		set({ loading: true, error: null })
		void get().loadIdentitySettings()
		try {
			const callback = await handleAuthCallback()
			if (callback?.type === 'invite' && callback.token) {
				++authRevision
				commitAuth({ ...signedOutState(null), inviteToken: callback.token })
				return
			}
			if (callback?.user) {
				await receiveUser(callback.user, callback.type === 'recovery')
				return
			}
			const user = await getUser()
			if (user) await receiveUser(user)
			else { ++authRevision; commitAuth(signedOutState(null)) }
		} catch (error) { ++authRevision; commitAuth(signedOutState(errorMessage(error))) }
	},
	clearError: () => set({ error: null, notice: null }),
}))

if (typeof window !== 'undefined' && !localMode) {
	onAuthChange((event, user) => {
		if (!user) { ++authRevision; commitAuth(signedOutState(null)); return }
		if (event === 'recovery') useAuth.setState({ passwordResetRequired: true })
		void receiveUser(user, event === 'recovery' ? true : undefined)
	})
	window.addEventListener(authExpiredEvent, () => {
		++authRevision
		commitAuth(signedOutState('Your session expired. Please sign in again.'))
	})
}

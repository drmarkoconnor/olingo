import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const identity = vi.hoisted(() => ({
	acceptInvite: vi.fn(), getSettings: vi.fn(), getUser: vi.fn(), handleAuthCallback: vi.fn(),
	login: vi.fn(), logout: vi.fn(), oauthLogin: vi.fn(), onAuthChange: vi.fn(),
	refreshSession: vi.fn(), requestPasswordRecovery: vi.fn(), updateUser: vi.fn(),
}))
vi.mock('@netlify/identity', () => identity)
const user = { id: 'mark', email: 'mark@example.test', name: 'Mark' }

beforeEach(() => {
	vi.resetModules(); vi.clearAllMocks()
	vi.stubEnv('VITE_REQUIRE_AUTH', 'true')
	vi.stubGlobal('window', new EventTarget())
	const values = new Map<string, string>()
	vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
	vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ user }), { status: 200 })))
	identity.getSettings.mockResolvedValue({ disableSignup: true, autoconfirm: false, providers: { google: false } })
	identity.handleAuthCallback.mockResolvedValue(null)
	identity.getUser.mockResolvedValue(null)
	identity.updateUser.mockResolvedValue(user)
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Identity account flows', () => {
	it('holds a recovery callback at the password form until update succeeds', async () => {
		identity.handleAuthCallback.mockResolvedValue({ type: 'recovery', user })
		const { useAuth } = await import('./useAuth')
		await useAuth.getState().refreshSession()
		expect(useAuth.getState().passwordResetRequired).toBe(true)
		identity.updateUser.mockRejectedValueOnce(new Error('Network unavailable'))
		await useAuth.getState().resetPassword('new-password')
		expect(useAuth.getState().passwordResetRequired).toBe(true)
		await useAuth.getState().resetPassword('new-password')
		expect(useAuth.getState().passwordResetRequired).toBe(false)
		expect(identity.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
	})
	it('accepts an invitation only with the callback token and chosen password', async () => {
		identity.handleAuthCallback.mockResolvedValue({ type: 'invite', user: null, token: 'invite-test' })
		identity.acceptInvite.mockResolvedValue(user)
		const { useAuth } = await import('./useAuth')
		await useAuth.getState().refreshSession()
		expect(useAuth.getState().authenticated).toBe(false)
		await useAuth.getState().acceptInvitePassword('new-password')
		expect(identity.acceptInvite).toHaveBeenCalledWith('invite-test', 'new-password')
		expect(useAuth.getState().userId).toBe('mark')
	})
	it('offers Google only when the real project settings enable it', async () => {
		const { useAuth } = await import('./useAuth')
		await useAuth.getState().loadIdentitySettings()
		await useAuth.getState().signInWithGoogle()
		expect(identity.oauthLogin).not.toHaveBeenCalled()
		identity.getSettings.mockResolvedValue({ disableSignup: true, providers: { google: true } })
		await useAuth.getState().loadIdentitySettings()
		await useAuth.getState().signInWithGoogle()
		expect(identity.oauthLogin).toHaveBeenCalledWith('google')
	})
	it('rejects mismatched browser and server accounts', async () => {
		identity.handleAuthCallback.mockResolvedValue({ type: 'oauth', user })
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 'ann' } }), { status: 200 }))
		const { useAuth } = await import('./useAuth')
		await useAuth.getState().refreshSession()
		expect(useAuth.getState().authenticated).toBe(false)
	})
	it('does not restore an old user when server verification returns after logout', async () => {
		const { useAuth } = await import('./useAuth')
		let finish!: (value: Response) => void
		vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
		const listener = identity.onAuthChange.mock.calls[0][0]
		listener('login', user)
		await useAuth.getState().signOut()
		finish(new Response('{}', { status: 200 }))
		await new Promise(resolve => setTimeout(resolve, 0))
		expect(useAuth.getState().authenticated).toBe(false)
	})
})

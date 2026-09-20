import { FormEvent, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/store/useAuth'

export default function AuthGate() {
	const { acceptInvitePassword, clearError, error, inviteToken, passwordResetRequired,
		loading, signInWithEmail, signInWithGoogle, requestReset, resetPassword,
		identitySettings, settingsError, notice } = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [forgotten, setForgotten] = useState(false)
	const [formError, setFormError] = useState('')
	const settingPassword = Boolean(inviteToken || passwordResetRequired)

	async function submit(event: FormEvent) {
		event.preventDefault()
		clearError()
		setFormError('')
		if (settingPassword) {
			if (password !== confirmPassword) { setFormError('The two passwords do not match.'); return }
			if (inviteToken) await acceptInvitePassword(password)
			else await resetPassword(password)
		} else if (forgotten) await requestReset(email)
		else await signInWithEmail(email, password)
	}

	return (
		<div className="auth-page"><section className="auth-card">
			<div className="auth-mark"><ShieldCheck size={30} /></div>
			<p className="eyebrow">Your Italian learning account</p>
			<h1>{settingPassword ? 'Set your password' : forgotten ? 'Reset your password' : 'Olingo'}</h1>
			<p className="auth-copy">Use your own account to keep your learning history and preferences separate.</p>
			<form className="auth-form" onSubmit={submit}>
				{!settingPassword && <>
					<label htmlFor="email">Email</label>
					<input autoComplete="email" id="email" onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required type="email" value={email} />
				</>}
				{(!forgotten || settingPassword) && <>
					<label htmlFor="password">{settingPassword ? 'New password' : 'Password'}</label>
					<input autoComplete={settingPassword ? 'new-password' : 'current-password'} id="password" minLength={settingPassword ? 8 : undefined} onChange={e => setPassword(e.target.value)} placeholder={settingPassword ? 'At least 8 characters' : 'Password'} required type="password" value={password} />
				</>}
				{settingPassword && <>
					<label htmlFor="confirm-password">Repeat new password</label>
					<input autoComplete="new-password" id="confirm-password" minLength={8} onChange={e => setConfirmPassword(e.target.value)} required type="password" value={confirmPassword} />
				</>}
				<button className="btn btn-primary" disabled={loading} type="submit">
					{loading ? 'Please wait…' : inviteToken ? 'Accept invitation' : passwordResetRequired ? 'Save new password' : forgotten ? 'Send reset link' : 'Sign in'}
				</button>
				{!settingPassword && <button className="btn btn-secondary" disabled={loading} onClick={() => { setForgotten(!forgotten); clearError(); setPassword('') }} type="button">{forgotten ? 'Back to sign in' : 'Forgot password?'}</button>}
				{!settingPassword && !forgotten && identitySettings?.providers.google && <button className="btn btn-secondary" disabled={loading} onClick={signInWithGoogle} type="button">Continue with Google</button>}
			</form>
			{(formError || error) && <p className="auth-error" role="alert">{formError || error}</p>}
			{notice && <p className="auth-note" role="status">{notice}</p>}
			{settingsError && <p className="auth-note">{settingsError}</p>}
			{identitySettings && <p className="auth-note">
				{identitySettings.disableSignup ? 'New accounts require an invitation from the site owner.' : 'Registration is currently open in the site configuration. This screen offers sign-in and invitation acceptance.'}
				{' '}{identitySettings.providers.google ? 'Google sign-in is enabled.' : 'Google sign-in is not enabled; use email and password.'}
			</p>}
		</section></div>
	)
}

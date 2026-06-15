import { FormEvent, useState } from 'react'
import { KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/store/useAuth'

export default function AuthGate() {
	const {
		acceptInvitePassword,
		clearError,
		error,
		inviteToken,
		loading,
		signInWithEmail,
		signInWithGoogle,
	} = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [invitePassword, setInvitePassword] = useState('')

	async function submitLogin(event: FormEvent) {
		event.preventDefault()
		clearError()
		await signInWithEmail(email, password)
	}

	async function submitInvite(event: FormEvent) {
		event.preventDefault()
		clearError()
		await acceptInvitePassword(invitePassword)
	}

	return (
		<div className="auth-page">
			<section className="auth-card">
				<div className="auth-mark">
					<ShieldCheck size={30} />
				</div>
				<p className="eyebrow">Private family access</p>
				<h1>Olingo</h1>
				<p className="auth-copy">
					Sign in to keep each person&apos;s progress separate and protect the
					paid AI feedback endpoints.
				</p>

				{inviteToken ? (
					<form className="auth-form" onSubmit={submitInvite}>
						<label htmlFor="invite-password">Set your password</label>
						<div className="input-icon">
							<KeyRound size={18} />
							<input
								id="invite-password"
								minLength={8}
								onChange={(event) => setInvitePassword(event.target.value)}
								placeholder="At least 8 characters"
								required
								type="password"
								value={invitePassword}
							/>
						</div>
						<button className="btn btn-primary" disabled={loading} type="submit">
							<LogIn size={18} />
							{loading ? 'Creating account' : 'Create account'}
						</button>
					</form>
				) : (
					<form className="auth-form" onSubmit={submitLogin}>
						<label htmlFor="email">Email</label>
						<div className="input-icon">
							<Mail size={18} />
							<input
								autoComplete="email"
								id="email"
								onChange={(event) => setEmail(event.target.value)}
								placeholder="you@example.com"
								required
								type="email"
								value={email}
							/>
						</div>
						<label htmlFor="password">Password</label>
						<div className="input-icon">
							<KeyRound size={18} />
							<input
								autoComplete="current-password"
								id="password"
								onChange={(event) => setPassword(event.target.value)}
								placeholder="Password"
								required
								type="password"
								value={password}
							/>
						</div>
						<button className="btn btn-primary" disabled={loading} type="submit">
							<LogIn size={18} />
							{loading ? 'Signing in' : 'Sign in'}
						</button>
						<button
							className="btn btn-secondary"
							disabled={loading}
							onClick={signInWithGoogle}
							type="button">
							<ShieldCheck size={18} />
							Continue with Google
						</button>
					</form>
				)}

				{error && <p className="auth-error">{error}</p>}
				<p className="auth-note">
					Accounts are created from Netlify invite links. Open signups stay
					closed.
				</p>
			</section>
		</div>
	)
}

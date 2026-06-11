import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'
import { useSync } from '@/store/useSync'
import { hasSupabase } from '@/lib/supabase'

export default function Settings() {
	const {
		dailyGoal,
		sound,
		tts,
		targetLevel,
		sentenceLength,
		setDailyGoal,
		setSound,
		setTTS,
		setTargetLevel,
		setSentenceLength,
	} = useSettings()
	const { userId, email, signInWithGoogle, signOut } = useAuth()
	const { syncing, lastSyncAt, error, syncAll } = useSync()
	const supaEnabled = hasSupabase()
	return (
		<div>
			<h2>Settings</h2>

			{supaEnabled && (
				<div className="tile">
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}>
						<div>
							<div style={{ fontWeight: 600 }}>Account</div>
							<div style={{ fontSize: 12, color: 'var(--muted)' }}>
								{email ? email : `Offline user: ${userId.slice(0, 8)}…`}
							</div>
						</div>
						{email ? (
							<button
								className="btn btn-muted"
								onClick={signOut}
								style={{ flex: 'none' }}>
								Sign out
							</button>
						) : (
							<button
								className="btn btn-primary"
								onClick={signInWithGoogle}
								style={{ flex: 'none' }}>
								Sign in with Google
							</button>
						)}
					</div>
				</div>
			)}

			<div className="tile">
				<label>Daily goal (minutes)</label>
				<input
					type="number"
					value={dailyGoal}
					onChange={(e) => setDailyGoal(parseInt(e.target.value || '0'))}
				/>
			</div>
			<div className="tile">
				<label>Level</label>
				<div className="segmented">
					{(['A1', 'A2', 'B1'] as const).map((level) => (
						<button
							type="button"
							key={level}
							className={targetLevel === level ? 'active' : ''}
							onClick={() => setTargetLevel(level)}>
							{level}
						</button>
					))}
				</div>
			</div>
			<div className="tile">
				<label>Sentence length</label>
				<div className="segmented">
					{(['short', 'medium', 'long'] as const).map((length) => (
						<button
							type="button"
							key={length}
							className={sentenceLength === length ? 'active' : ''}
							onClick={() => setSentenceLength(length)}>
							{length}
						</button>
					))}
				</div>
			</div>
			<div className="tile">
				<label>
					<input
						type="checkbox"
						checked={sound}
						onChange={(e) => setSound(e.target.checked)}
					/>{' '}
					Sound effects
				</label>
			</div>
			<div className="tile">
				<label>
					<input
						type="checkbox"
						checked={tts}
						onChange={(e) => setTTS(e.target.checked)}
					/>{' '}
					Text-to-Speech (Italian)
				</label>
			</div>

			{supaEnabled && (
				<div className="tile">
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}>
						<div>
							<div style={{ fontWeight: 600 }}>Cloud sync</div>
							<div style={{ fontSize: 12, color: 'var(--muted)' }}>
								Last sync:{' '}
								{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
							</div>
							{error && (
								<div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>
							)}
						</div>
						<button
							className="btn btn-primary"
							disabled={syncing}
							onClick={syncAll}
							style={{ flex: 'none' }}>
							{syncing ? 'Syncing…' : 'Sync now'}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

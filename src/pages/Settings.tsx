import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'
import { getCurriculumStage } from '@/learning/curriculum'

export default function Settings() {
	const {
		dailyGoal,
		sound,
		tts,
		targetLevel,
		sentenceLength,
		programWeek,
		setDailyGoal,
		setSound,
		setTTS,
		setTargetLevel,
		setSentenceLength,
		setProgramWeek,
	} = useSettings()
	const { userId, email, localMode, name, signOut } = useAuth()
	const stage = getCurriculumStage(programWeek)
	return (
		<div>
			<h2>Settings</h2>

			<div className="tile">
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						gap: 16,
					}}>
					<div>
						<div style={{ fontWeight: 600 }}>Account</div>
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>
							{localMode
								? `Local browser profile: ${userId.slice(0, 12)}`
								: email ?? name ?? userId}
						</div>
					</div>
					{!localMode && (
						<button
							className="btn btn-muted"
							onClick={signOut}
							style={{ flex: 'none' }}>
							Sign out
						</button>
					)}
				</div>
			</div>

			<div className="tile">
				<label>Daily goal (minutes)</label>
				<input
					type="number"
					value={dailyGoal}
					onChange={(e) => setDailyGoal(parseInt(e.target.value || '0'))}
				/>
			</div>
			<div className="tile">
				<label>Program week</label>
				<input
					type="number"
					min={1}
					max={24}
					value={programWeek}
					onChange={(e) => setProgramWeek(parseInt(e.target.value || '1'))}
				/>
				<div className="settings-note">
					Week {stage.weeks[0]}-{stage.weeks[1]}: {stage.title}
				</div>
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

			<div className="tile">
				<div style={{ fontWeight: 600 }}>Family data</div>
				<div style={{ fontSize: 12, color: 'var(--muted)' }}>
					Progress is keyed to this account in the browser. Server backups use
					the same Netlify Identity user id.
				</div>
			</div>
		</div>
	)
}

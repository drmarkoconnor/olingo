import { useState } from 'react'
import { saveLearnerTargetLevel } from '@/learning/learner-profile'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'
import { cefrLevels, type CefrLevel } from '@/learning/content'
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
	const { userId, email, localMode, name, signOut, identitySettings, settingsError, loadIdentitySettings } = useAuth()
	const stage = getCurriculumStage(programWeek)
	const [savingLevel, setSavingLevel] = useState(false)
	const [levelError, setLevelError] = useState('')
	async function chooseLevel(level: CefrLevel) {
		setSavingLevel(true)
		setLevelError('')
		const isCurrentUser = () => useAuth.getState().userId === userId && useAuth.getState().authenticated
		try {
			const profile = await saveLearnerTargetLevel(userId, level, isCurrentUser)
			if (profile && isCurrentUser()) setTargetLevel(level)
		} catch {
			if (isCurrentUser()) setLevelError('Your level could not be saved. Please try again.')
		} finally {
			if (isCurrentUser()) setSavingLevel(false)
		}
	}
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

			{!localMode && <div className="tile">
				<div style={{ fontWeight: 600 }}>Account access</div>
				{identitySettings ? <>
					<p>{identitySettings.disableSignup ? 'Registration is invitation only.' : 'Registration is open in the site configuration.'}</p>
					<p>{identitySettings.providers.google ? 'Google sign-in is enabled.' : 'Google sign-in is not enabled. Email and password sign-in is available.'}</p>
					<p className="settings-note">Each family member needs their own account. The site owner manages invitations and sign-in providers in Netlify. No account is created by selecting a learner name.</p>
				</> : <p>{settingsError ?? 'Checking the site’s account settings…'}</p>}
				<button className="btn btn-muted" type="button" onClick={loadIdentitySettings}>Refresh access settings</button>
			</div>}

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
				{levelError && <p role="alert">{levelError}</p>}
				<div className="segmented">
					{cefrLevels.map((level) => (
						<button
							type="button"
							key={level}
							className={targetLevel === level ? 'active' : ''}
							disabled={savingLevel}
							onClick={() => void chooseLevel(level)}>
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

import { FormEvent, useEffect, useState, useRef } from 'react'
import { Check, Mic2, Play, Tags, Volume2 } from 'lucide-react'
import { db, type MistakeItem } from '@/storage/db'
import { useAuth } from '@/store/useAuth'
import { submitMistakeRepair } from '@/learning/progress'
import type { EvaluationResult } from '@/learning/evaluator'
import { canTTS, speak } from '@/lib/tts'

export default function Mistakes() {
	const { userId } = useAuth()
	const [mistakes, setMistakes] = useState<MistakeItem[]>([])
	const [answers, setAnswers] = useState<Record<string, string>>({})
	const [feedback, setFeedback] = useState<Record<string, EvaluationResult>>({})
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [checking, setChecking] = useState<Record<string, boolean>>({})
	const inFlight = useRef(new Set<string>())
	const [startedAt, setStartedAt] = useState<Record<string, number>>({})

	useEffect(() => {
		load()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId])

	async function load() {
		const rows = await db.mistakes.where('userId').equals(userId).toArray()
		rows.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		)
		setMistakes(rows)
	}

	async function repair(event: FormEvent, mistake: MistakeItem) {
		event.preventDefault()
		const answer = answers[mistake.id]?.trim()
		if (!answer || mistake.status === 'repaired' || inFlight.current.has(mistake.id)) return
		inFlight.current.add(mistake.id)
		setChecking((current) => ({ ...current, [mistake.id]: true }))
		setErrors((current) => ({ ...current, [mistake.id]: '' }))
		try {
		const msUsed = Date.now() - (startedAt[mistake.id] ?? Date.now())
		const result = await submitMistakeRepair({
			userId,
			mistake,
			answer,
			msUsed,
		})
		setFeedback((current) => ({ ...current, [mistake.id]: result.result }))
		setStartedAt((current) => ({ ...current, [mistake.id]: Date.now() }))
		await load()
		} catch (error) {
			setErrors((current) => ({ ...current, [mistake.id]: error instanceof Error ? error.message : 'Unable to check this repair. Please try again.' }))
		} finally {
			inFlight.current.delete(mistake.id)
			setChecking((current) => ({ ...current, [mistake.id]: false }))
		}
	}

	function updateAnswer(mistakeId: string, value: string) {
		setAnswers((current) => ({ ...current, [mistakeId]: value }))
		setStartedAt((current) => ({
			...current,
			[mistakeId]: current[mistakeId] ?? Date.now(),
		}))
	}

	return (
		<div className="page-stack">
			<div className="page-heading">
				<p className="eyebrow">Mistake Gym</p>
				<h1>Repair notebook</h1>
			</div>

			{mistakes.length === 0 ? (
				<div className="empty-state">
					<div className="completion-badge">
						<Check size={34} />
					</div>
					<h2>No repairs waiting.</h2>
				</div>
			) : (
				<div className="mistake-list">
					{mistakes.map((mistake) => (
						<article className="mistake-card" key={mistake.id}>
							<div className="mistake-card-top">
								<span className={`status-dot ${mistake.status}`} />
								<strong>{mistake.status}</strong>
								<span>
									{mistake.attempts} attempt
									{mistake.attempts === 1 ? '' : 's'}
								</span>
							</div>
							<p className="prompt">{mistake.promptEnglish}</p>
							<div className="answer-comparison">
								<div>
									<span>Your answer</span>
									<p>{mistake.userAnswer || 'Blank answer'}</p>
								</div>
								<div>
									<span>Model</span>
									<p>{mistake.correctedItalian}</p>
								</div>
							</div>
							<div className="hint">
								<Tags size={15} />
								{mistake.explanation}
							</div>
							<div className="tag-row">
								{mistake.tags.map((tag) => (
									<span key={tag}>{tag}</span>
								))}
							</div>
							<div className="repair-drills">
								<span>
									<Mic2 size={15} />
									Say aloud, then type
								</span>
								<p>{mistake.repairPrompts?.[0] ?? mistake.promptEnglish}</p>
							</div>
							<form className="repair-form" onSubmit={(event) => repair(event, mistake)}>
								<textarea
									value={answers[mistake.id] ?? ''}
									disabled={mistake.status === 'repaired' || checking[mistake.id]}
									onChange={(event) => updateAnswer(mistake.id, event.target.value)}
									placeholder="Type the repaired Italian sentence..."
									rows={3}
								/>
								<div className="control-bar">
									{canTTS() && (
										<button
											className="btn btn-secondary"
											type="button"
											onClick={() => speak(mistake.correctedItalian, 'it-IT')}>
											<Volume2 size={18} />
										Hear Italian
										</button>
									)}
									<button
										className="btn btn-primary"
										type="submit"
										disabled={mistake.status === 'repaired' || checking[mistake.id]}>
										<Play size={18} />
										{checking[mistake.id] ? 'Checking…' : 'Check repair'}
									</button>
								</div>
							</form>
							{errors[mistake.id] && <p role="alert">{errors[mistake.id]}</p>}
							{feedback[mistake.id] && (
								<div
									className={
										feedback[mistake.id].communicative
											? 'feedback feedback-good'
											: 'feedback feedback-repair'
									}>
									<strong>{feedback[mistake.id].message}</strong>
									<span className="feedback-note">
										{feedback[mistake.id].shortFeedback}
									</span>
								</div>
							)}
						</article>
					))}
				</div>
			)}
		</div>
	)
}

import { useEffect, useState } from 'react'
import { Check, RotateCcw, Tags } from 'lucide-react'
import { db, type MistakeItem } from '@/storage/db'
import { useAuth } from '@/store/useAuth'

export default function Mistakes() {
	const { userId } = useAuth()
	const [mistakes, setMistakes] = useState<MistakeItem[]>([])

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

	async function markRepaired(mistake: MistakeItem) {
		await db.mistakes.put({
			...mistake,
			status: 'repaired',
			lastReviewedAt: new Date().toISOString(),
		})
		await load()
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
							<button
								className="btn btn-secondary"
								type="button"
								disabled={mistake.status === 'repaired'}
								onClick={() => markRepaired(mistake)}>
								<RotateCcw size={18} />
								Mark repaired
							</button>
						</article>
					))}
				</div>
			)}
		</div>
	)
}

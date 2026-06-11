import { useEffect, useState, type ReactNode } from 'react'
import {
	Activity,
	Gauge,
	Layers,
	Lightbulb,
	RotateCcw,
	Sparkles,
	Tags,
	Target,
} from 'lucide-react'
import { getFluencySnapshot } from '@/learning/progress'
import { useAuth } from '@/store/useAuth'

type Snapshot = Awaited<ReturnType<typeof getFluencySnapshot>>

export default function Stats() {
	const { userId } = useAuth()
	const [snapshot, setSnapshot] = useState<Snapshot>({
		total: 0,
		correct: 0,
		accuracy: 0,
		averageMs: 0,
		openMistakes: 0,
		repaired: 0,
		conceptHints: 0,
		wordBankHints: 0,
		topMisspellings: [],
		categoryErrors: [],
	})

	useEffect(() => {
		getFluencySnapshot(userId).then(setSnapshot)
	}, [userId])

	const averageSeconds = snapshot.averageMs
		? Math.round(snapshot.averageMs / 1000)
		: 0
	const averageLabel = snapshot.averageMs
		? averageSeconds > 0
			? `${averageSeconds}s`
			: '<1s'
		: 'No data'

	return (
		<div className="page-stack">
			<div className="page-heading">
				<p className="eyebrow">Fluency stats</p>
				<h1>Production dashboard</h1>
			</div>

			<div className="stat-grid">
				<StatTile
					icon={<Target size={22} />}
					label="Production prompts"
					value={snapshot.total.toString()}
				/>
				<StatTile
					icon={<Gauge size={22} />}
					label="First-pass accuracy"
					value={`${snapshot.accuracy}%`}
				/>
				<StatTile
					icon={<Activity size={22} />}
					label="Average response"
					value={averageLabel}
				/>
				<StatTile
					icon={<RotateCcw size={22} />}
					label="Open repairs"
					value={snapshot.openMistakes.toString()}
				/>
				<StatTile
					icon={<Lightbulb size={22} />}
					label="Concept hints"
					value={snapshot.conceptHints.toString()}
				/>
				<StatTile
					icon={<Layers size={22} />}
					label="Word-bank hints"
					value={snapshot.wordBankHints.toString()}
				/>
			</div>

			<section className="panel">
				<div className="panel-title">
					<Sparkles size={20} />
					<h2>Narrative progress</h2>
				</div>
				<div className="fluency-track">
					<div className="track-step complete">Cafe opener</div>
					<div className={snapshot.total >= 4 ? 'track-step complete' : 'track-step'}>
						Family table
					</div>
					<div className={snapshot.total >= 10 ? 'track-step complete' : 'track-step'}>
						Bookshop chat
					</div>
					<div className={snapshot.repaired >= 3 ? 'track-step complete' : 'track-step'}>
						Newsstand opinions
					</div>
				</div>
			</section>

			<div className="insight-grid">
				<section className="panel">
					<div className="panel-title">
						<Tags size={20} />
						<h2>Category errors</h2>
					</div>
					<div className="metric-list">
						{snapshot.categoryErrors.length ? (
							snapshot.categoryErrors.map((item) => (
								<div className="metric-row" key={item.tag}>
									<span>{item.tag}</span>
									<strong>{item.count}</strong>
								</div>
							))
						) : (
							<div className="metric-row muted-row">
								<span>No category errors yet</span>
								<strong>0</strong>
							</div>
						)}
					</div>
				</section>
				<section className="panel">
					<div className="panel-title">
						<Lightbulb size={20} />
						<h2>Misspellings</h2>
					</div>
					<div className="metric-list">
						{snapshot.topMisspellings.length ? (
							snapshot.topMisspellings.map((item) => (
									<div
										className="metric-row"
										key={`${item.word}-${item.correction}`}>
										<span>
											{item.word} {'->'} {item.correction}
										</span>
									<strong>{item.count}</strong>
								</div>
							))
						) : (
							<div className="metric-row muted-row">
								<span>No misspellings yet</span>
								<strong>0</strong>
							</div>
						)}
					</div>
				</section>
			</div>
		</div>
	)
}

function StatTile({
	icon,
	label,
	value,
}: {
	icon: ReactNode
	label: string
	value: string
}) {
	return (
		<div className="stat-tile">
			<div className="stat-icon">{icon}</div>
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	)
}

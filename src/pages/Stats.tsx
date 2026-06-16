import { useEffect, useState, type ReactNode } from 'react'
import {
	Activity,
	Gauge,
	Layers,
	Lightbulb,
	Mic2,
	RotateCcw,
	Sparkles,
	Tags,
	Target,
} from 'lucide-react'
import { getFluencySnapshot } from '@/learning/progress'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'
import { getCurriculumStage, roundFocusWeights } from '@/learning/curriculum'
import { loadSceneCards, type SceneCard } from '@/learning/scene-episodes'

type Snapshot = Awaited<ReturnType<typeof getFluencySnapshot>>

export default function Stats() {
	const { userId } = useAuth()
	const { programWeek } = useSettings()
	const stage = getCurriculumStage(programWeek)
	const [snapshot, setSnapshot] = useState<Snapshot>({
		total: 0,
		correct: 0,
		accuracy: 0,
		communicativeAccuracy: 0,
		averageMs: 0,
		openMistakes: 0,
		repaired: 0,
		spokenFirst: 0,
		conceptHints: 0,
		wordBankHints: 0,
		pronunciationAttempts: 0,
		latestPronunciationScore: null,
		averagePronunciationScore: 0,
		topMisspellings: [],
		categoryErrors: [],
		phraseFamilies: [],
		phaseCounts: [],
	})
	const [sceneCards, setSceneCards] = useState<SceneCard[]>([])

	useEffect(() => {
		getFluencySnapshot(userId).then(setSnapshot)
		loadSceneCards(userId, programWeek).then(setSceneCards)
	}, [programWeek, userId])

	const averageSeconds = snapshot.averageMs
		? Math.round(snapshot.averageMs / 1000)
		: 0
	const averageLabel = snapshot.averageMs
		? averageSeconds > 0
			? `${averageSeconds}s`
			: '<1s'
		: 'No data'
	const latestPronunciationLabel =
		typeof snapshot.latestPronunciationScore === 'number'
			? `${snapshot.latestPronunciationScore}/100`
			: 'No score'

	return (
		<div className="page-stack">
			<div className="page-heading">
				<p className="eyebrow">Fluency stats</p>
				<h1>Production dashboard</h1>
			</div>

			<section className="panel curriculum-summary">
				<div>
					<p className="eyebrow">Week {programWeek}</p>
					<h2>{stage.title}</h2>
					<p>{stage.goals.join(' - ')}</p>
				</div>
				<div className="round-mix">
					{Object.entries(roundFocusWeights).map(([focus, weight]) => (
						<span key={focus}>
							<strong>{weight}%</strong>
							{focus}
						</span>
					))}
				</div>
			</section>

			<div className="stat-grid">
				<StatTile
					icon={<Target size={22} />}
					label="Production prompts"
					value={snapshot.total.toString()}
				/>
				<StatTile
					icon={<Gauge size={22} />}
					label="Communicative attempts"
					value={`${snapshot.communicativeAccuracy}%`}
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
					icon={<Sparkles size={22} />}
					label="Said aloud first"
					value={snapshot.spokenFirst.toString()}
				/>
				<StatTile
					icon={<Lightbulb size={22} />}
					label="Concept hints"
					value={snapshot.conceptHints.toString()}
				/>
				<StatTile
					icon={<Mic2 size={22} />}
					label="Latest read-aloud"
					value={latestPronunciationLabel}
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
					{sceneCards.map((scene) => (
						<div
							className={
								scene.complete
									? 'track-step complete'
									: scene.available
									? 'track-step active'
									: 'track-step'
							}
							key={scene.id}>
							{scene.title}
							<span>
								{scene.available
									? `${scene.completedCount}/${scene.targetCount}`
									: 'locked'}
							</span>
						</div>
					))}
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

			<section className="panel">
				<div className="panel-title">
					<Layers size={20} />
					<h2>Phrase mastery</h2>
				</div>
				<div className="metric-list">
					{snapshot.phraseFamilies.length ? (
						snapshot.phraseFamilies.map((item) => (
							<div className="metric-row" key={item.family}>
								<span>{item.family}</span>
								<strong>{item.rate}%</strong>
							</div>
						))
					) : (
						<div className="metric-row muted-row">
							<span>No phrase-family data yet</span>
							<strong>0</strong>
						</div>
					)}
				</div>
			</section>
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

import { useEffect, useState, type ReactNode } from 'react'
import {
	Activity,
	CalendarDays,
	Clock3,
	Gauge,
	Layers,
	Lightbulb,
	Mic2,
	RotateCcw,
	Sparkles,
	Tags,
	Target,
	Dumbbell,
} from 'lucide-react'
import { getFluencySnapshot } from '@/learning/progress'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'
import {
	getCurriculumStage,
	roundFocusLabels,
	roundFocusWeights,
} from '@/learning/curriculum'
import { loadSceneCards, type SceneCard } from '@/learning/scene-episodes'
import { masteryStageLabel } from '@/learning/skill-mastery'

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
		spokenAttempts: 0,
		practiceDays: 0,
		totalActiveMs: 0,
		maxDailyActiveMs: 0,
		maxDailyQuestions: 0,
		drillAttempts: 0,
		drillPracticeDays: 0,
		drillActiveMs: 0,
		medianResponseLatencyMs: 0,
		unassistedRate: 0,
		transferRate: 0,
		masteredSkills: 0,
		developingSkills: 0,
		skillMastery: [],
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

	const averageSeconds = snapshot.medianResponseLatencyMs
		? Math.round(snapshot.medianResponseLatencyMs / 1000)
		: 0
	const averageLabel = snapshot.medianResponseLatencyMs
		? averageSeconds > 0
			? `${averageSeconds}s`
			: '<1s'
		: 'No data'
	const latestPronunciationLabel =
		typeof snapshot.latestPronunciationScore === 'number'
			? `${snapshot.latestPronunciationScore}/100`
			: 'No score'
	const formatTime = (ms: number) => {
		const minutes = Math.round(ms / 60_000)
		if (minutes < 1) return ms > 0 ? '<1m' : '0m'
		const hours = Math.floor(minutes / 60)
		const remainingMinutes = minutes % 60
		return hours ? `${hours}h ${remainingMinutes}m` : `${minutes}m`
	}

	return (
		<div className="page-stack">
			<div className="page-heading">
				<p className="eyebrow">Fluency stats</p>
				<h1>Production dashboard</h1>
			</div>

			<section className="panel curriculum-summary">
				<div>
					<p className="eyebrow">24-week spiral - Week {programWeek}</p>
					<h2>{stage.title}</h2>
					<p>{stage.goals.join(' - ')}</p>
				</div>
				<div className="round-mix" aria-label="Planned practice mix">
					<p className="round-mix-title">Planned practice mix</p>
					{Object.entries(roundFocusWeights).map(([focus, weight]) => (
						<span key={focus}>
							<strong>{weight}%</strong>
							{roundFocusLabels[focus as keyof typeof roundFocusLabels]}
						</span>
					))}
				</div>
			</section>

			<div className="stat-grid">
				<StatTile
					icon={<CalendarDays size={22} />}
					label="Practice days"
					value={snapshot.practiceDays.toString()}
				/>
				<StatTile
					icon={<Clock3 size={22} />}
					label="Total active practice"
					value={formatTime(snapshot.totalActiveMs)}
				/>
				<StatTile
					icon={<Sparkles size={22} />}
					label="Biggest day: answers / active"
					value={`${snapshot.maxDailyQuestions} / ${formatTime(
						snapshot.maxDailyActiveMs
					)}`}
				/>
				<StatTile
					icon={<Target size={22} />}
					label="Production prompts"
					value={snapshot.total.toString()}
				/>
				<StatTile
					icon={<Dumbbell size={22} />}
					label="Focused drill prompts"
					value={`${snapshot.drillAttempts} / ${formatTime(snapshot.drillActiveMs)}`}
				/>
				<StatTile
					icon={<Gauge size={22} />}
					label="Communicative attempts"
					value={`${snapshot.communicativeAccuracy}%`}
				/>
				<StatTile
					icon={<Activity size={22} />}
					label="Typical spoken start"
					value={averageLabel}
				/>
				<StatTile
					icon={<RotateCcw size={22} />}
					label="Open repairs"
					value={snapshot.openMistakes.toString()}
				/>
				<StatTile
					icon={<Sparkles size={22} />}
					label="Voice answers"
					value={snapshot.spokenAttempts.toString()}
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
					label="Speaking skills ready"
					value={snapshot.masteredSkills.toString()}
				/>
				<StatTile
					icon={<Target size={22} />}
					label="Unassisted success"
					value={`${snapshot.unassistedRate}%`}
				/>
				<StatTile
					icon={<Gauge size={22} />}
					label="Situation transfer"
					value={`${snapshot.transferRate}%`}
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
					<h2>Speaking skill mastery</h2>
				</div>
				<div className="metric-list">
					{snapshot.skillMastery.length ? (
						snapshot.skillMastery.map((item) => (
							<div className="metric-row" key={item.skillId}>
								<span>
									{item.label}
									<small>{item.attempts} attempts across {item.contexts} situation(s)</small>
								</span>
								<strong>{masteryStageLabel(item.stage)}</strong>
							</div>
						))
					) : (
						<div className="metric-row muted-row">
							<span>Complete a speaking staircase to begin tracking skills</span>
							<strong>Not started</strong>
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

import { useEffect, useState, type CSSProperties } from 'react'
import {
	ArrowRight,
	CheckCircle2,
	Lock,
	MapPin,
	Play,
	RefreshCw,
	Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
	advanceSceneEpisode,
	loadSceneCards,
	type SceneCard,
} from '@/learning/scene-episodes'
import { useAuth } from '@/store/useAuth'
import { useSettings } from '@/store/useSettings'

export default function Scenes() {
	const navigate = useNavigate()
	const { userId } = useAuth()
	const {
		programWeek,
		selectedSceneAction,
		selectedSceneId,
		setSelectedScene,
		targetLevel,
	} = useSettings()
	const [sceneCards, setSceneCards] = useState<SceneCard[]>([])
	const [loading, setLoading] = useState(true)
	const [advancingId, setAdvancingId] = useState<string | null>(null)

	useEffect(() => {
		let mounted = true
		setLoading(true)
		loadSceneCards(userId, programWeek)
			.then((cards) => {
				if (mounted) setSceneCards(cards)
			})
			.catch(console.error)
			.finally(() => mounted && setLoading(false))
		return () => {
			mounted = false
		}
	}, [programWeek, userId])

	function startScene(scene: SceneCard, action = scene.actions[0]) {
		if (!scene.available) return
		setSelectedScene(scene.id, action)
		navigate('/')
	}

	async function createNextScenario(scene: SceneCard) {
		if (!scene.available || !scene.complete) return
		setAdvancingId(scene.id)
		try {
			const cards = await advanceSceneEpisode({
				userId,
				sceneId: scene.id,
				programWeek,
				targetLevel,
			})
			setSceneCards(cards)
			const next = cards.find((card) => card.id === scene.id)
			if (next) setSelectedScene(next.id, next.actions[0])
		} finally {
			setAdvancingId(null)
		}
	}

	if (loading) {
		return (
			<div className="page-stack">
				<div className="page-heading">
					<p className="eyebrow">Narrative progress</p>
					<h1>Opening your Italian neighbourhood...</h1>
				</div>
			</div>
		)
	}

	return (
		<div className="page-stack">
			<div className="page-heading">
				<p className="eyebrow">Narrative progress</p>
				<h1>Italian neighbourhood</h1>
			</div>
			<div className="scene-grid">
				{sceneCards.map((scene) => {
					const selected =
						selectedSceneId === scene.id &&
						scene.actions.includes(selectedSceneAction)
					const progressPercent = Math.round(
						(scene.completedCount / scene.targetCount) * 100
					)
					return (
						<article
							className={[
								'scene-card',
								!scene.available ? 'locked' : '',
								selected ? 'selected' : '',
								scene.complete ? 'complete' : '',
							]
								.filter(Boolean)
								.join(' ')}
							key={scene.id}
							style={
								{
									'--scene-image': `url(${scene.imageUrl})`,
									'--scene-accent': scene.accent,
								} as CSSProperties
							}>
							<div className="scene-card-content">
								<div className="scene-topline">
									<span className="scene-pill">
										<MapPin size={14} />
										{scene.location}
									</span>
									<span className="scene-pill">{scene.level}</span>
								</div>
								<div>
									<h2>{scene.title}</h2>
									<p>{scene.narrative}</p>
								</div>
								<div className="scene-progress-meter">
									<div>
										<span
											style={
												{ width: `${Math.min(100, progressPercent)}%` } as CSSProperties
											}
										/>
									</div>
									<strong>
										{scene.available
											? `${scene.completedCount}/${scene.targetCount} sentence reps`
											: scene.lockedReason}
									</strong>
								</div>
								{scene.available && (
									<div className="scene-action-row" aria-label={`${scene.title} actions`}>
										{scene.actions.map((action) => (
											<button
												className={
													selectedSceneId === scene.id &&
													selectedSceneAction === action
														? 'scene-action-chip active'
														: 'scene-action-chip'
												}
												type="button"
												key={action}
												onClick={() => startScene(scene, action)}>
												{action}
											</button>
										))}
									</div>
								)}
								<div className="scene-footer">
									<span>
										{scene.complete ? (
											<CheckCircle2 size={15} />
										) : (
											<Sparkles size={15} />
										)}
										{scene.complete ? 'Scenario complete' : scene.progressLabel}
									</span>
									<div className="scene-footer-actions">
										{scene.complete && (
											<button
												className="icon-button"
												type="button"
												title="Create next scenario"
												disabled={advancingId === scene.id}
												onClick={() => createNextScenario(scene)}>
												<RefreshCw
													size={18}
													className={
														advancingId === scene.id ? 'spin' : undefined
													}
												/>
											</button>
										)}
										<button
											className="icon-button"
											type="button"
											title={scene.available ? 'Start this scene' : 'Locked'}
											disabled={!scene.available}
											onClick={() => startScene(scene)}>
											{scene.available ? (
												selected ? (
													<ArrowRight size={18} />
												) : (
													<Play size={18} />
												)
											) : (
												<Lock size={18} />
											)}
										</button>
									</div>
								</div>
							</div>
						</article>
					)
				})}
			</div>
		</div>
	)
}

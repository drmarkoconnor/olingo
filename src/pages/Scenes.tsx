import { type CSSProperties } from 'react'
import { Lock, MapPin, Play, Sparkles } from 'lucide-react'
import { scenes, getExercisesForScene } from '@/learning/content'

export default function Scenes() {
	return (
		<div className="page-stack">
			<div className="page-heading">
				<p className="eyebrow">Narrative progress</p>
				<h1>Italian neighbourhood</h1>
			</div>
			<div className="scene-grid">
				{scenes.map((scene, index) => {
					const available = index < 2 || scene.id === 'station'
					const exerciseCount = getExercisesForScene(scene.id).length
					return (
						<article
							className={available ? 'scene-card' : 'scene-card locked'}
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
									<span className="scene-pill">{exerciseCount} drills</span>
								</div>
								<div>
									<h2>{scene.title}</h2>
									<p>{scene.narrative}</p>
								</div>
								<div className="scene-footer">
									<span>
										<Sparkles size={15} />
										{scene.progressLabel}
									</span>
									<button className="icon-button" type="button" title="Scene status">
										{available ? <Play size={18} /> : <Lock size={18} />}
									</button>
								</div>
							</div>
						</article>
					)
				})}
			</div>
		</div>
	)
}

import {
	exercises,
	getExercise,
	getScene,
	scenes,
	type CefrLevel,
	type Scene,
} from '@/learning/content'
import { db, type SceneEpisode } from '@/storage/db'

export const sceneEpisodeTargetCount = 8

export type SceneCard = Scene & {
	baseSceneId: string
	episodeId?: string
	scenarioIndex: number
	completedCount: number
	targetCount: number
	available: boolean
	complete: boolean
	lockedReason?: string
	source?: SceneEpisode['source']
}

type SceneScenario = Pick<
	Scene,
	'title' | 'location' | 'level' | 'objective' | 'narrative' | 'progressLabel' | 'actions'
>

type GeneratedSceneScenarioResponse = {
	scenario?: Partial<SceneScenario>
	provider?: 'openai' | 'fallback'
}

const firstOpenSceneIds = new Set(['milan-cafe', 'family-table', 'station'])

const fallbackScenarios: Record<string, SceneScenario[]> = {
	'milan-cafe': [
		{
			title: 'Morning Bar Counter',
			location: 'Brera, Milan',
			level: 'A2 -> B1',
			objective: 'Order confidently, add one opinion, and keep the chat moving.',
			narrative:
				'You are standing at the counter during the morning rush. Keep sentences short, warm, and quick.',
			progressLabel: 'Cafe scenario',
			actions: ['Order', 'Ask opinion', 'React', 'Continue chat'],
		},
		{
			title: 'Rainy Cafe Table',
			location: 'Brera, Milan',
			level: 'A2 -> B1',
			objective: 'Explain preferences and make a small plan with a friend.',
			narrative:
				'Rain has pushed everyone inside. You talk about what to drink, what to do next, and what you think.',
			progressLabel: 'Cafe scenario',
			actions: ['Choose', 'Ask opinion', 'Compare', 'Plan next time'],
		},
		{
			title: 'Neighbour At The Cafe',
			location: 'Brera, Milan',
			level: 'B1',
			objective: 'Recognise someone, ask a natural follow-up, and answer without freezing.',
			narrative:
				'A neighbour recognises you while you wait. The goal is a small, natural exchange, not perfection.',
			progressLabel: 'Cafe scenario',
			actions: ['Greet', 'Ask follow-up', 'React', 'Close politely'],
		},
	],
	'family-table': [
		{
			title: 'Sunday Family Lunch',
			location: 'Dinner with friends',
			level: 'A2 -> B1',
			objective: 'Talk about family news, offer help, and ask one follow-up.',
			narrative:
				'The table is busy and affectionate. You need practical sentences about people, plans, and small events.',
			progressLabel: 'Family scenario',
			actions: ['Offer help', 'Tell a story', 'Ask follow-up', 'Compare tastes'],
		},
		{
			title: 'Planning A Visit',
			location: 'Dinner with friends',
			level: 'B1',
			objective: 'Use modal verbs to suggest, refuse softly, and agree on a plan.',
			narrative:
				'Everyone is trying to organise the next visit. You help make the plan clear without overcomplicating it.',
			progressLabel: 'Family scenario',
			actions: ['Suggest', 'Ask follow-up', 'Disagree softly', 'Confirm'],
		},
		{
			title: 'Family News Catch-Up',
			location: 'Dinner with friends',
			level: 'B1',
			objective: 'Narrate what happened recently and react to someone else.',
			narrative:
				'Someone shares recent family news. You practise past-tense replies that sound interested and human.',
			progressLabel: 'Family scenario',
			actions: ['Tell a story', 'React', 'Ask follow-up', 'Offer help'],
		},
	],
	bookshop: [
		{
			title: 'Bookshop Recommendation',
			location: 'Independent bookshop',
			level: 'B1 bridge',
			objective: 'Ask for a recommendation and explain what you usually like.',
			narrative:
				'The bookseller asks what kind of stories you enjoy. You answer clearly and ask for one suggestion.',
			progressLabel: 'Bookshop scenario',
			actions: ['Ask advice', 'Describe taste', 'Compare', 'Recommend back'],
		},
		{
			title: 'Choosing A Gift',
			location: 'Independent bookshop',
			level: 'B1 bridge',
			objective: 'Describe another person and decide between two options.',
			narrative:
				'You want a thoughtful gift. Explain the person, compare choices, and make a simple decision.',
			progressLabel: 'Bookshop scenario',
			actions: ['Describe taste', 'Compare', 'Ask advice', 'Choose'],
		},
	],
	'piazza-newsstand': [
		{
			title: 'Headline In The Piazza',
			location: 'Piazza del Duomo',
			level: 'B1 bridge',
			objective: 'Summarise a simple headline and give a careful opinion.',
			narrative:
				'You spot a headline and use it as a gentle entry into news, public life, and opinion language.',
			progressLabel: 'Newsstand scenario',
			actions: ['Read headline', 'Summarise', 'Ask view', 'Disagree softly'],
		},
		{
			title: 'Local Issue Chat',
			location: 'Piazza del Duomo',
			level: 'B1 -> B2',
			objective: 'Discuss a local issue with reasons, agreement, and one soft disagreement.',
			narrative:
				'A local issue is on the front page. Keep it adult and clear: what happened, what you think, why.',
			progressLabel: 'Newsstand scenario',
			actions: ['Summarise', 'Ask view', 'Agree', 'Disagree softly'],
		},
	],
	station: [
		{
			title: 'Platform Change',
			location: 'Italian station',
			level: 'A2 repair',
			objective: 'Ask for details, confirm the platform, and repair misunderstanding.',
			narrative:
				'The station is noisy and the platform changes. Use short sentences to stay calm and understood.',
			progressLabel: 'Station scenario',
			actions: ['Ask', 'Confirm', 'Repeat', 'Solve'],
		},
		{
			title: 'Delayed Train',
			location: 'Italian station',
			level: 'A2 -> B1',
			objective: 'Explain a delay, ask what to do, and confirm the next step.',
			narrative:
				'Your train is delayed. You need practical repair language, not a beautiful speech.',
			progressLabel: 'Station scenario',
			actions: ['Ask', 'Explain problem', 'Confirm', 'Thank'],
		},
	],
	cinema: [
		{
			title: 'After The Film',
			location: 'Florence cinema',
			level: 'B1 bridge',
			objective: 'React to a film, explain what worked, and disagree gently.',
			narrative:
				'You leave the cinema with a friend. Give a real opinion with one reason and one follow-up question.',
			progressLabel: 'Cinema scenario',
			actions: ['Invite', 'React', 'Explain why', 'Plan next time'],
		},
		{
			title: 'Choosing The Next Film',
			location: 'Florence cinema',
			level: 'B1 -> B2',
			objective: 'Compare films, express preference, and make a plan.',
			narrative:
				'You are choosing what to watch next. Compare options without getting trapped in perfect grammar.',
			progressLabel: 'Cinema scenario',
			actions: ['Compare', 'React', 'Explain why', 'Plan next time'],
		},
	],
}

function episodeId(userId: string, sceneId: string, scenarioIndex: number) {
	return `${userId}:scene:${sceneId}:${scenarioIndex}`
}

function initialCreatedAt(scenarioIndex: number) {
	return scenarioIndex === 0 ? '1970-01-01T00:00:00.000Z' : new Date().toISOString()
}

function scenarioFor(scene: Scene, scenarioIndex: number, scenario?: Partial<SceneScenario>) {
	const variants = fallbackScenarios[scene.id] ?? []
	const fallback = variants[scenarioIndex % Math.max(1, variants.length)] ?? scene
	return {
		title: scenario?.title?.trim() || (scenarioIndex === 0 ? scene.title : fallback.title),
		location: scenario?.location?.trim() || fallback.location || scene.location,
		level: scenario?.level?.trim() || fallback.level || scene.level,
		objective: scenario?.objective?.trim() || fallback.objective || scene.objective,
		narrative: scenario?.narrative?.trim() || fallback.narrative || scene.narrative,
		progressLabel:
			scenario?.progressLabel?.trim() ||
			`${fallback.progressLabel || scene.progressLabel} ${scenarioIndex + 1}`,
		actions:
			scenario?.actions?.filter(Boolean).slice(0, 4) ??
			fallback.actions?.slice(0, 4) ??
			scene.actions,
	}
}

function makeEpisode(
	userId: string,
	scene: Scene,
	scenarioIndex: number,
	source: SceneEpisode['source'],
	scenario?: Partial<SceneScenario>
): SceneEpisode {
	const merged = scenarioFor(scene, scenarioIndex, scenario)
	return {
		...scene,
		...merged,
		id: episodeId(userId, scene.id, scenarioIndex),
		userId,
		baseSceneId: scene.id,
		scenarioIndex,
		source,
		createdAt: initialCreatedAt(scenarioIndex),
		completedAt: null,
		retired: 0,
	}
}

function countByScene(entries: { sceneId: string; count?: number }[]) {
	return entries.reduce<Record<string, number>>((counts, entry) => {
		counts[entry.sceneId] = (counts[entry.sceneId] ?? 0) + (entry.count ?? 1)
		return counts
	}, {})
}

async function buildExerciseSceneMap(userId: string) {
	const generated = await db.generatedExercises.where('userId').equals(userId).toArray()
	const map = new Map<string, string>()
	for (const exercise of exercises) {
		map.set(exercise.id, exercise.sceneId)
	}
	for (const generatedExercise of generated) {
		map.set(generatedExercise.id, generatedExercise.sceneId)
	}
	for (const log of await db.exerciseLogs.where('userId').equals(userId).toArray()) {
		if (map.has(log.exerciseId)) continue
		const exercise = getExercise(log.exerciseId)
		if (exercise) map.set(log.exerciseId, exercise.sceneId)
	}
	return map
}

function availableReason(
	sceneId: string,
	lifetimeCounts: Record<string, number>,
	programWeek: number
) {
	if (firstOpenSceneIds.has(sceneId)) return null
	if (sceneId === 'bookshop') {
		const remaining = sceneEpisodeTargetCount - (lifetimeCounts['milan-cafe'] ?? 0)
		return remaining > 0
			? `Complete ${remaining} more cafe sentence reps first.`
			: null
	}
	if (sceneId === 'piazza-newsstand') {
		if (programWeek < 17) return 'News and politics open from week 17.'
		const remaining = sceneEpisodeTargetCount - (lifetimeCounts.bookshop ?? 0)
		return remaining > 0
			? `Complete ${remaining} more bookshop sentence reps first.`
			: null
	}
	if (sceneId === 'cinema') {
		const remaining = sceneEpisodeTargetCount - (lifetimeCounts['family-table'] ?? 0)
		return remaining > 0
			? `Complete ${remaining} more family-table sentence reps first.`
			: null
	}
	return null
}

async function ensureActiveEpisode(userId: string, scene: Scene) {
	const existing = await db.sceneEpisodes
		.where('userId')
		.equals(userId)
		.and((episode) => episode.baseSceneId === scene.id && episode.retired !== 1)
		.first()
	if (existing) return existing

	const episodes = await db.sceneEpisodes
		.where('userId')
		.equals(userId)
		.and((episode) => episode.baseSceneId === scene.id)
		.toArray()
	const nextIndex =
		episodes.length === 0
			? 0
			: Math.max(...episodes.map((episode) => episode.scenarioIndex)) + 1
	const episode = makeEpisode(userId, scene, nextIndex, nextIndex === 0 ? 'seed' : 'fallback')
	await db.sceneEpisodes.put(episode)
	return episode
}

async function logCountsForScenes(userId: string) {
	const [logs, exerciseSceneMap] = await Promise.all([
		db.exerciseLogs.where('userId').equals(userId).toArray(),
		buildExerciseSceneMap(userId),
	])

	const communicativeLogs = logs.filter(
		(log) => (log.communicative ?? log.correct) === 1 && log.mode !== 'mistake-repair'
	)
	const lifetime = countByScene(
		communicativeLogs
			.map((log) => {
				const sceneId = exerciseSceneMap.get(log.exerciseId)
				return sceneId ? { sceneId } : null
			})
			.filter((entry): entry is { sceneId: string } => Boolean(entry))
	)

	return {
		lifetime,
		logs: communicativeLogs,
		exerciseSceneMap,
	}
}

function countEpisodeLogs(
	episode: SceneEpisode,
	logs: { exerciseId: string; ts: string }[],
	exerciseSceneMap: Map<string, string>
) {
	const createdAt = new Date(episode.createdAt).getTime()
	return logs.filter((log) => {
		const logTime = new Date(log.ts).getTime()
		return (
			logTime >= createdAt &&
			exerciseSceneMap.get(log.exerciseId) === episode.baseSceneId
		)
	}).length
}

export async function loadSceneCards(
	userId: string,
	programWeek = 1
): Promise<SceneCard[]> {
	const { lifetime, logs, exerciseSceneMap } = await logCountsForScenes(userId)
	const cards: SceneCard[] = []

	for (const scene of scenes) {
		const lockedReason = availableReason(scene.id, lifetime, programWeek)
		const available = !lockedReason
		const episode = available ? await ensureActiveEpisode(userId, scene) : null
		const completedCount = episode
			? countEpisodeLogs(episode, logs, exerciseSceneMap)
			: lifetime[scene.id] ?? 0
		const cappedCount = Math.min(completedCount, sceneEpisodeTargetCount)
		const complete = completedCount >= sceneEpisodeTargetCount

		cards.push({
			...(episode ?? scene),
			id: scene.id,
			baseSceneId: scene.id,
			episodeId: episode?.id,
			scenarioIndex: episode?.scenarioIndex ?? 0,
			completedCount: cappedCount,
			targetCount: sceneEpisodeTargetCount,
			available,
			complete,
			lockedReason: lockedReason ?? undefined,
			source: episode?.source,
		})
	}

	return cards
}

async function generateRemoteScenario(args: {
	scene: Scene
	programWeek: number
	targetLevel?: CefrLevel
	nextIndex: number
	previousTitles: string[]
}) {
	if (typeof window === 'undefined') return null
	try {
		const response = await fetch('/api/generate-scene-scenario', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				baseScene: {
					id: args.scene.id,
					title: args.scene.title,
					location: args.scene.location,
					level: args.scene.level,
					objective: args.scene.objective,
					narrative: args.scene.narrative,
					actions: args.scene.actions,
				},
				programWeek: args.programWeek,
				targetLevel: args.targetLevel,
				nextIndex: args.nextIndex,
				previousTitles: args.previousTitles,
			}),
		})
		if (!response.ok) return null
		return (await response.json()) as GeneratedSceneScenarioResponse
	} catch {
		return null
	}
}

export async function advanceSceneEpisode(args: {
	userId: string
	sceneId: string
	programWeek: number
	targetLevel?: CefrLevel
}) {
	const scene = getScene(args.sceneId)
	const cards = await loadSceneCards(args.userId, args.programWeek)
	const card = cards.find((item) => item.id === scene.id)
	if (!card?.available || !card.complete || !card.episodeId) return cards

	const episodes = await db.sceneEpisodes
		.where('userId')
		.equals(args.userId)
		.and((episode) => episode.baseSceneId === scene.id)
		.toArray()
	const current = episodes.find((episode) => episode.id === card.episodeId)
	if (!current) return cards

	const nextIndex = Math.max(...episodes.map((episode) => episode.scenarioIndex)) + 1
	const remote = await generateRemoteScenario({
		scene,
		programWeek: args.programWeek,
		targetLevel: args.targetLevel,
		nextIndex,
		previousTitles: episodes.map((episode) => episode.title),
	})
	const next = makeEpisode(
		args.userId,
		scene,
		nextIndex,
		remote?.provider ?? 'fallback',
		remote?.scenario
	)

	await db.transaction('rw', db.sceneEpisodes, async () => {
		await db.sceneEpisodes.put({
			...current,
			completedAt: new Date().toISOString(),
			retired: 1,
		})
		await db.sceneEpisodes.put(next)
	})

	return loadSceneCards(args.userId, args.programWeek)
}

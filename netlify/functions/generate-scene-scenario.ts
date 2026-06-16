import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { getEnv } from './_shared/env'
import { json, methodNotAllowed, readJson } from './_shared/http'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

type Body = {
	baseScene?: {
		id?: string
		title?: string
		location?: string
		level?: string
		objective?: string
		narrative?: string
		actions?: string[]
	}
	programWeek?: number
	targetLevel?: CefrLevel
	nextIndex?: number
	previousTitles?: string[]
}

type SceneScenario = {
	title: string
	location: string
	level: string
	objective: string
	narrative: string
	progressLabel: string
	actions: string[]
}

const sceneScenarioSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		scenario: {
			type: 'object',
			additionalProperties: false,
			properties: {
				title: { type: 'string' },
				location: { type: 'string' },
				level: { type: 'string' },
				objective: { type: 'string' },
				narrative: { type: 'string' },
				progressLabel: { type: 'string' },
				actions: {
					type: 'array',
					items: { type: 'string' },
					minItems: 4,
					maxItems: 4,
				},
			},
			required: [
				'title',
				'location',
				'level',
				'objective',
				'narrative',
				'progressLabel',
				'actions',
			],
		},
	},
	required: ['scenario'],
} as const

function outputText(data: any) {
	if (typeof data.output_text === 'string') return data.output_text
	const text = data.output
		?.flatMap((item: any) => item.content ?? [])
		?.find((content: any) => content.type === 'output_text')?.text
	return typeof text === 'string' ? text : ''
}

function simpleHash(value: string) {
	let hash = 5381
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 33) ^ value.charCodeAt(index)
	}
	return (hash >>> 0).toString(36)
}

function fallbackScenario(body: Body): SceneScenario {
	const title = body.baseScene?.title || 'Italian conversation'
	const location = body.baseScene?.location || 'Everyday Italy'
	const actions = body.baseScene?.actions?.length
		? body.baseScene.actions.slice(0, 4)
		: ['Ask', 'React', 'Explain', 'Confirm']
	while (actions.length < 4) actions.push('Continue')
	return {
		title: `${title} ${Math.max(1, Number(body.nextIndex ?? 0) + 1)}`,
		location,
		level: body.targetLevel || body.baseScene?.level || 'B1',
		objective:
			body.baseScene?.objective ||
			'Produce short, useful spoken Italian sentences without waiting for perfection.',
		narrative:
			body.baseScene?.narrative ||
			'You are in a familiar everyday situation. Say the meaning quickly, then polish it once.',
		progressLabel: 'Generated scenario',
		actions,
	}
}

function sanitizeScenario(scenario: SceneScenario, fallback: SceneScenario) {
	const actions = scenario.actions.filter(Boolean).slice(0, 4)
	while (actions.length < 4) actions.push(fallback.actions[actions.length] ?? 'Continue')
	return {
		title: scenario.title?.trim() || fallback.title,
		location: scenario.location?.trim() || fallback.location,
		level: scenario.level?.trim() || fallback.level,
		objective: scenario.objective?.trim() || fallback.objective,
		narrative: scenario.narrative?.trim() || fallback.narrative,
		progressLabel: scenario.progressLabel?.trim() || fallback.progressLabel,
		actions,
	}
}

async function generateWithOpenAI(body: Body) {
	const apiKey = getEnv('OPENAI_API_KEY')
	if (!apiKey) return null

	const response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: getEnv('OPENAI_CONTENT_MODEL') || getEnv('OPENAI_MODEL') || 'gpt-5.4-mini',
			store: false,
			input: [
				{
					role: 'system',
					content:
						'You create fresh Italian-learning conversation scenarios. Return only schema-valid JSON. Keep the stable context, but vary the situation, objective, and action labels.',
				},
				{
					role: 'user',
					content: JSON.stringify({
						task: 'Generate one new scene scenario for sentence-production practice.',
						baseScene: body.baseScene,
						programWeek: body.programWeek ?? 1,
						targetLevel: body.targetLevel ?? 'B1',
						nextIndex: body.nextIndex ?? 0,
						previousTitles: (body.previousTitles ?? []).slice(-12),
						requirements: [
							'Do not repeat previousTitles or make a near-duplicate.',
							'Keep the same broad context, e.g. cafe remains cafe and station remains station.',
							'Make the scenario usable for spoken sentence production, not reading comprehension.',
							'Use four short action labels that can drive drill selection.',
							'Do not include markdown.',
						],
					}),
				},
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'italian_scene_scenario',
					strict: true,
					schema: sceneScenarioSchema,
				},
			},
		}),
	})
	if (!response.ok) return null
	const data = await response.json()
	const text = outputText(data)
	if (!text) return null
	try {
		return (JSON.parse(text) as { scenario?: SceneScenario }).scenario ?? null
	} catch {
		return null
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body?.baseScene?.id) {
		return json({ error: 'Missing base scene' }, { status: 400 })
	}

	const fallback = fallbackScenario(body)
	const generated = await generateWithOpenAI(body)
	const scenario = sanitizeScenario(generated ?? fallback, fallback)
	const provider = generated ? 'openai' : 'fallback'
	const packId = `${new Date().toISOString()}-${simpleHash(
		JSON.stringify({
			sceneId: body.baseScene.id,
			nextIndex: body.nextIndex,
			programWeek: body.programWeek,
			targetLevel: body.targetLevel,
		})
	)}`

	const store = getStore({ name: 'generated-packs', consistency: 'strong' })
	await store.setJSON(
		`users/${encodeURIComponent(auth.user.id)}/scenes/${encodeURIComponent(packId)}`,
		{
			userId: auth.user.id,
			packId,
			provider,
			baseSceneId: body.baseScene.id,
			programWeek: body.programWeek ?? null,
			targetLevel: body.targetLevel ?? null,
			scenario,
			createdAt: new Date().toISOString(),
		}
	)

	return json({ packId, provider, scenario })
}

export const config = {
	path: '/api/generate-scene-scenario',
}

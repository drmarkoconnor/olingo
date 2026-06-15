import { getStore } from '@netlify/blobs'
import { authFailed, requireUser } from './_shared/auth'
import { json, methodNotAllowed, readJson } from './_shared/http'

type SourceItem = {
	id: string
	sourceName: string
	title: string
	link: string
	topic: string
	summary?: string
	prompt: string
}

type Body = {
	sourceItem?: SourceItem
	level?: 'A1' | 'A2' | 'B1'
	programWeek?: number
}

function keyFor(source: SourceItem, level: string) {
	return `source/${encodeURIComponent(level)}/${encodeURIComponent(source.id)}`
}

function makePack(source: SourceItem, level: string) {
	return {
		id: `${level}-${source.id}`,
		title: source.title,
		level,
		sourceName: source.sourceName,
		sourceUrl: source.link,
		createdAt: new Date().toISOString(),
		exercises: [
			{
				promptEnglish: 'I read this news and it seems interesting.',
				targetItalian: 'Ho letto questa notizia e mi sembra interessante.',
				phase: 'warmup',
				action: 'Read headline',
			},
			{
				promptEnglish: `I read that: ${source.title}.`,
				targetItalian: `Ho letto che ${source.title}.`,
				phase: 'produce',
				action: 'Summarise',
			},
			{
				promptEnglish: 'What do you think about it?',
				targetItalian: 'Che cosa ne pensi?',
				phase: 'speak',
				action: 'Ask view',
			},
			{
				promptEnglish: 'Maybe, but I am not completely sure.',
				targetItalian: 'Forse, ma non sono del tutto sicuro.',
				phase: 'repair',
				action: 'Disagree softly',
			},
		],
	}
}

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	const auth = await requireUser()
	if (authFailed(auth)) return auth.response

	const body = await readJson<Body>(req)
	if (!body?.sourceItem) return json({ error: 'Missing source item' }, { status: 400 })
	if ((body.programWeek ?? 1) < 17) {
		return json(
			{
				error: 'Source-derived drills unlock in week 17',
				unlockWeek: 17,
			},
			{ status: 403 }
		)
	}

	const level = body.level ?? 'B1'
	const store = getStore({ name: 'generated-packs', consistency: 'strong' })
	const key = keyFor(body.sourceItem, level)
	const cached = await store.get(key, { type: 'json' })
	if (cached) return json({ ...(cached as object), cached: true })

	const pack = makePack(body.sourceItem, level)
	await store.setJSON(key, pack)
	return json({ ...pack, cached: false })
}

export const config = {
	path: '/api/generate-content-pack',
}

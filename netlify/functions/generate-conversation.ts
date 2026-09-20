import { createHash, randomUUID } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { courseLessons } from '../../src/learning/conversation-course'
import type { ConversationLine, GeneratedConversationEpisode, GenerateConversationResponse } from '../../src/learning/generated-conversation'
import { authFailed, requireUser } from './_shared/auth'
import { json, methodNotAllowed } from './_shared/http'
import { parseConversationRequest, repeatsSituation, requestConversationDraft, situationKey, validateEpisodeDraft, validateTurnDraft, type GenerationHistory } from './_shared/conversation-generation'

const unavailable = () => json({ error: 'Fresh conversation is unavailable. You can retry or choose the authored practice episode.', status: 'unavailable' }, { status: 503 })
const historyHash = (history: ConversationLine[]) => createHash('sha256').update(JSON.stringify(history)).digest('hex')
const branchKey = (prefix: string, episodeId: string, turnIndex: number, history: ConversationLine[]) => `${prefix}/episodes/${episodeId}/branches/${turnIndex}-${historyHash(history)}`

type GenerationLease = { store: ReturnType<typeof getStore>; key: string; token: string }
async function acquireLease(store: ReturnType<typeof getStore>, key: string): Promise<GenerationLease | null> {
	const existing = await store.getWithMetadata(key, { type: 'json' })
	if (existing && Number(existing.data.expiresAt) > Date.now()) return null
	const token = randomUUID()
	const result = await store.setJSON(key, { token, expiresAt: Date.now() + 90_000 }, existing ? { onlyIfMatch: existing.etag } : { onlyIfNew: true })
	return result.modified ? { store, key, token } : null
}
const generating = () => json({ status: 'generating', error: 'This conversation is already being generated. Please retry in a moment.' }, { status: 409, headers: { 'Retry-After': '2' } })

export default async (req: Request) => {
	if (req.method !== 'POST') return methodNotAllowed()
	let lease: GenerationLease | null = null
	try {
		const auth = await requireUser()
		if (authFailed(auth)) return auth.response
		if (req.headers.get('X-Olingo-User') !== auth.user.id) {
			return json({ code: 'account-changed', error: 'Your signed-in account changed. Reload before generating a conversation.' }, { status: 409 })
		}
		const raw = await req.text()
		if (raw.length > 64_000) return json({ error: 'Conversation request is too large.' }, { status: 413 })
		let parsed: unknown
		try { parsed = JSON.parse(raw) } catch { return json({ error: 'Invalid conversation request.' }, { status: 400 }) }
		const body = parseConversationRequest(parsed)
		if (!body) return json({ error: 'Invalid conversation request.' }, { status: 400 })
		const lesson = courseLessons.find((entry) => entry.id === body.lessonId)
		if (!lesson || lesson.turns.length !== 3) return json({ error: 'Unknown course lesson.' }, { status: 404 })
		const store = getStore({ name: 'conversation-generation', consistency: 'strong' })
		const prefix = `users/${encodeURIComponent(auth.user.id)}`
		const intentKey = body.mode === 'episode' && body.requestId ? `${prefix}/requests/${body.requestId}` : undefined
		const intentHash = createHash('sha256').update(JSON.stringify(body)).digest('hex')
		if (intentKey) {
			const saved = await store.get(intentKey, { type: 'json' }) as { hash: string; response: GenerateConversationResponse } | null
			if (saved) return saved.hash === intentHash ? json(saved.response) : json({ error: 'This request ID was already used for a different conversation request.' }, { status: 409 })
		}
		const indexKey = `${prefix}/lessons/${lesson.id}/recent`
		const storedRecent = await store.get(indexKey, { type: 'json' }) as GenerationHistory[] | null
		const recent = Array.isArray(storedRecent) ? storedRecent.slice(0, 40) : []

		if (body.mode === 'next-turn') {
			const episode = await store.get(`${prefix}/episodes/${body.episodeId}/episode`, { type: 'json' }) as GeneratedConversationEpisode | null
			if (!episode || episode.lessonId !== lesson.id) return json({ error: 'This generated episode was not found for your account.' }, { status: 404 })
			const history = body.history!
			// Keep the submitted dialogue anchored to partner lines actually issued for this episode.
			for (let index = 0; index < body.turnIndex!; index += 1) {
				const priorBranch = index > 0 ? await store.get(branchKey(prefix, episode.id, index, history.slice(0, index * 2)), { type: 'json' }) as Extract<GenerateConversationResponse, { turn: unknown }> | null : null
				const expected = priorBranch && 'turn' in priorBranch ? priorBranch.turn.npcLine : episode.turns[index].npcLine
				if (history[index * 2].text !== expected.trim()) return json({ error: 'The dialogue does not match this episode. Reload the saved conversation.' }, { status: 400 })
			}
			const cacheKey = branchKey(prefix, episode.id, body.turnIndex!, history)
			const cached = await store.get(cacheKey, { type: 'json' }) as GenerateConversationResponse | null
			if (cached) return json(cached)
			lease = await acquireLease(store, `${cacheKey}/lock`)
			if (!lease) return generating()
			const justCompleted = await store.get(cacheKey, { type: 'json' }) as GenerateConversationResponse | null
			if (justCompleted) return json(justCompleted)
			for (let attempt = 0; attempt < 2; attempt += 1) {
				const draft = await requestConversationDraft({ lesson, mode: 'next-turn', interests: episode.interests, episode, source: episode.source, history, turnIndex: body.turnIndex, recent, avoid: [], retryReason: attempt ? 'Previous output failed turn or exact source-quotation validation. Return a natural follow-up with supported facts only.' : undefined })
				if (!draft) return unavailable()
				if (!validateTurnDraft(draft, lesson, episode.source)) continue
				if (history.filter((line) => line.role === 'partner').some((line) => line.text.trim() === draft.turn.npcLine.trim())) continue
				const response: GenerateConversationResponse = { turn: { id: lesson.turns[body.turnIndex!].id, ...draft.turn }, episodeId: episode.id, lessonId: lesson.id, provider: 'openai', generationId: randomUUID() }
				await store.setJSON(cacheKey, response)
				return json(response)
			}
			return unavailable()
		}

		if (intentKey) {
			lease = await acquireLease(store, `${intentKey}/lock`)
			if (!lease) return generating()
			const justCompleted = await store.get(intentKey, { type: 'json' }) as { hash: string; response: GenerateConversationResponse } | null
			if (justCompleted) return justCompleted.hash === intentHash ? json(justCompleted.response) : json({ error: 'This request ID was already used for a different conversation request.' }, { status: 409 })
		}
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const draft = await requestConversationDraft({ lesson, mode: 'episode', interests: body.interests, source: body.source, recent, avoid: body.avoidSituations ?? [], retryReason: attempt ? 'Previous output repeated a situation or failed schema/source grounding. Change the actual setting, roles, goal and constraint while preserving the curriculum goal.' : undefined })
			if (!draft) return unavailable()
			if (!validateEpisodeDraft(draft, lesson, body.source)) continue
			if (repeatsSituation(draft, recent, body.avoidSituations)) continue
			const id = randomUUID()
			const createdAt = new Date().toISOString()
			const episode: GeneratedConversationEpisode = {
				id, lessonId: lesson.id, level: lesson.level, canDo: lesson.canDo,
				title: draft.title, context: draft.context, situationKey: situationKey(draft.novelty),
				turns: draft.turns.map((turn, index) => ({ id: lesson.turns[index].id, ...turn })),
				...(body.source ? { source: body.source } : {}), ...(body.interests ? { interests: body.interests } : {}), createdAt,
			}
			await store.setJSON(`${prefix}/episodes/${id}/episode`, episode)
			await store.setJSON(`${prefix}/episodes/${id}/provenance`, { createdAt, sourceQuotes: draft.sourceQuotes, source: body.source ?? null, novelty: draft.novelty })
			await store.setJSON(indexKey, [{ episodeId: id, title: episode.title, context: episode.context, situationKey: episode.situationKey, novelty: draft.novelty, createdAt }, ...recent].slice(0, 40))
			const response: GenerateConversationResponse = { episode, provider: 'openai', generationId: id }
			if (intentKey) await store.setJSON(intentKey, { hash: intentHash, response })
			return json(response)
		}
		return unavailable()
	} catch {
		return unavailable()
	} finally {
		if (lease) {
			const owned = lease
			await owned.store.get(owned.key, { type: 'json' }).then(async (value) => {
				if (value?.token === owned.token) await owned.store.delete(owned.key)
			}).catch(() => undefined)
		}
	}
}

export const config = { path: '/api/generate-conversation' }

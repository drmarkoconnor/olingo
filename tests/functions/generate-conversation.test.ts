import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../netlify/functions/generate-conversation'
import { courseLessons } from '../../src/learning/conversation-course'
import { parseConversationRequest, validateEpisodeDraft } from '../../netlify/functions/_shared/conversation-generation'

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), userId: 'learner-one', signedIn: true }))
vi.mock('@netlify/blobs', () => ({ getStore: () => ({
	get: async (key: string) => mocks.records.get(key) ?? null,
	getWithMetadata: async (key: string) => mocks.records.has(key) ? { data: mocks.records.get(key), etag: JSON.stringify(mocks.records.get(key)) } : null,
	delete: async (key: string) => { mocks.records.delete(key) },
	setJSON: async (key: string, value: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) => {
		if (options?.onlyIfNew && mocks.records.has(key)) return { modified: false }
		if (options?.onlyIfMatch && options.onlyIfMatch !== JSON.stringify(mocks.records.get(key))) return { modified: false }
		mocks.records.set(key, structuredClone(value)); return { modified: true }
	},
}) }))
vi.mock('../../netlify/functions/_shared/auth', () => ({
	requireUser: async () => mocks.signedIn ? { user: { id: mocks.userId } } : { response: new Response('', { status: 401 }) },
	authFailed: (result: unknown) => Boolean(result && typeof result === 'object' && 'response' in result),
}))
const lesson = courseLessons.find((item) => item.level === 'A2' && item.strandId === 'food')!
const baseDraft = () => ({
	title: 'A shared picnic', context: 'You and a neighbour arrange a picnic; one guest cannot eat dairy.',
	novelty: { setting: 'village park', roles: 'neighbour and picnic organiser', goal: 'agree a shared menu', constraint: 'one guest cannot eat dairy' },
	turns: [
		{ npcLine: 'Cosa portiamo al picnic?', instruction: 'Suggest a dish you could bring.', example: 'Posso portare delle verdure.', hint: 'Offer a practical choice.' },
		{ npcLine: 'Un ospite non può mangiare latticini.', instruction: 'Suggest an option for that guest.', example: 'Prepariamo una pasta senza formaggio.', hint: 'Keep the dietary constraint.' },
		{ npcLine: 'A che ora ci incontriamo?', instruction: 'Suggest a time and check whether it suits your friend.', example: 'Alle dodici va bene per te?', hint: 'A question completes the arrangement.' },
	], sourceQuotes: [] as string[],
})
const responseFor = (data: unknown) => Response.json({ output_text: JSON.stringify(data) })
const request = (body: unknown, expectedUser = mocks.userId) => new Request('https://example.test/api/generate-conversation', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Olingo-User': expectedUser }, body: JSON.stringify(body) })
const initialBody = { lessonId: lesson.id, mode: 'episode' }
beforeEach(() => {
	mocks.records.clear(); mocks.userId = 'learner-one'; mocks.signedIn = true
	vi.stubGlobal('Netlify', { env: { get: (name: string) => name === 'OPENAI_API_KEY' ? 'sk-test-only' : undefined } })
})
afterEach(() => vi.unstubAllGlobals())

describe('renewable course conversations', () => {
	it('keeps canonical curriculum anchors and persists provenance before returning a fresh episode', async () => {
		const upstream = vi.fn(async () => responseFor(baseDraft()))
		vi.stubGlobal('fetch', upstream)
		const response = await handler(request({ ...initialBody, interests: ['gardening', 'music'] }))
		expect(response.status).toBe(200)
		const { episode } = await response.json()
		expect(episode).toMatchObject({ lessonId: lesson.id, level: lesson.level, canDo: lesson.canDo, interests: ['gardening', 'music'] })
		expect(episode.turns.map((turn: { id: string }) => turn.id)).toEqual(lesson.turns.map((turn) => turn.id))
		expect(mocks.records.has(`users/learner-one/episodes/${episode.id}/episode`)).toBe(true)
		const sent = JSON.parse(upstream.mock.calls[0][1].body)
		expect(JSON.parse(sent.input[1].content)).toMatchObject({ optionalInterests: ['gardening', 'music'], lesson: { level: lesson.level, canDo: lesson.canDo } })
		expect(JSON.parse(sent.input[1].content).canonicalTurnGoals).toEqual(lesson.turns.map((turn, index) => ({ index, canonicalTurnId: turn.id, instructionCue: turn.instruction, transferInstructionCue: turn.transferInstruction })))
	})
	it('retries material repetition rather than accepting a renamed scenario', async () => {
		const fresh = baseDraft()
		fresh.title = 'A cooking class'
		fresh.context = 'A cook and a student plan a quick supper at a cooking school with a limited budget.'
		fresh.novelty = { setting: 'cooking school', roles: 'teacher and adult student', goal: 'prepare a quick supper', constraint: 'a limited food budget' }
		const upstream = vi.fn().mockResolvedValueOnce(responseFor(baseDraft())).mockResolvedValueOnce(responseFor(baseDraft())).mockResolvedValueOnce(responseFor(fresh))
		vi.stubGlobal('fetch', upstream)
		await handler(request(initialBody))
		const second = await handler(request(initialBody))
		expect(second.status).toBe(200)
		expect((await second.json()).episode.title).toBe('A cooking class')
		expect(upstream).toHaveBeenCalledTimes(3)
	})
	it('replays the same generation intent without paying for another provider call', async () => {
		const upstream = vi.fn(async () => responseFor(baseDraft()))
		vi.stubGlobal('fetch', upstream)
		const body = { ...initialBody, requestId: '00000000-0000-4000-8000-000000000001' }
		const first = await (await handler(request(body))).json()
		const second = await (await handler(request(body))).json()
		expect(second).toEqual(first)
		expect(upstream).toHaveBeenCalledTimes(1)
		expect((await handler(request({ ...body, interests: ['changed'] }))).status).toBe(409)
	})
	it('leases concurrent generation intents so a double click cannot trigger two provider calls', async () => {
		let release!: () => void
		let started!: () => void
		const pending = new Promise<void>((resolve) => { release = resolve })
		const requested = new Promise<void>((resolve) => { started = resolve })
		const upstream = vi.fn(async () => { started(); await pending; return responseFor(baseDraft()) })
		vi.stubGlobal('fetch', upstream)
		const body = { ...initialBody, requestId: '00000000-0000-4000-8000-000000000002' }
		const first = handler(request(body))
		await requested
		const second = await handler(request(body))
		expect(second.status).toBe(409)
		expect(await second.json()).toMatchObject({ status: 'generating' })
		expect(upstream).toHaveBeenCalledTimes(1)
		release()
		expect((await first).status).toBe(200)
		expect((await handler(request(body))).status).toBe(200)
		expect(upstream).toHaveBeenCalledTimes(1)
	})

	it('branches on the actual learner answer and caches the precise continuation', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => responseFor(baseDraft())))
		const { episode } = await (await handler(request(initialBody))).json()
		const turn = { npcLine: 'La zuppa va bene. Come la trasportiamo?', instruction: 'Explain how you will carry the soup safely.', example: 'Uso un contenitore chiuso.', hint: 'Give a practical answer.' }
		const upstream = vi.fn(async () => responseFor({ turn, sourceQuotes: [] }))
		vi.stubGlobal('fetch', upstream)
		const history = [{ role: 'partner', text: episode.turns[0].npcLine }, { role: 'learner', text: 'Preferirei portare una zuppa.' }]
		const body = { ...initialBody, mode: 'next-turn', turnIndex: 1, episodeId: episode.id, history }
		const next = await (await handler(request(body))).json()
		expect(next.turn).toMatchObject({ ...turn, id: lesson.turns[1].id })
		const sent = JSON.parse(upstream.mock.calls[0][1].body)
		expect(JSON.parse(sent.input[1].content).confirmedDialogue).toEqual(history)
		expect(JSON.parse(sent.input[1].content).nextCanonicalGoal).toEqual({ index: 1, canonicalTurnId: lesson.turns[1].id, instructionCue: lesson.turns[1].instruction, transferInstructionCue: lesson.turns[1].transferInstruction })
		expect(await (await handler(request(body))).json()).toEqual(next)
		expect(upstream).toHaveBeenCalledTimes(1)
	})
	it('validates the persisted dynamic partner line for the third turn, not the original planned line', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => responseFor(baseDraft())))
		const { episode } = await (await handler(request(initialBody))).json()
		const history = [{ role: 'partner', text: episode.turns[0].npcLine }, { role: 'learner', text: 'Porto una zuppa.' }]
		const branch = { npcLine: 'Come trasportiamo la zuppa?', instruction: 'Explain how to carry it.', example: 'La porto in un contenitore.', hint: 'Give a practical detail.' }
		vi.stubGlobal('fetch', vi.fn(async () => responseFor({ turn: branch, sourceQuotes: [] })))
		expect((await handler(request({ ...initialBody, mode: 'next-turn', turnIndex: 1, episodeId: episode.id, history }))).status).toBe(200)
		const nextDraft = { turn: { npcLine: 'Ottimo, e chi prepara il pane?', instruction: 'Offer to bring some bread as well.', example: 'Posso portare anche il pane.', hint: 'Offer one more thing.' }, sourceQuotes: [] }
		const upstream = vi.fn(async () => responseFor(nextDraft))
		vi.stubGlobal('fetch', upstream)
		const thirdHistory = [...history, { role: 'partner', text: branch.npcLine }, { role: 'learner', text: 'Uso un contenitore chiuso.' }]
		const body = { ...initialBody, mode: 'next-turn', turnIndex: 2, episodeId: episode.id, history: thirdHistory }
		const result = await handler(request(body))
		expect(result.status).toBe(200)
		expect((await result.json()).turn.id).toBe(lesson.turns[2].id)
		const staleHistory = thirdHistory.map((line, index) => index === 2 ? { ...line, text: episode.turns[1].npcLine } : line)
		expect((await handler(request({ ...body, history: staleHistory }))).status).toBe(400)
		expect(upstream).toHaveBeenCalledTimes(1)
	})

	it('rejects a stale account header before storage or generation', async () => {
		const upstream = vi.fn()
		vi.stubGlobal('fetch', upstream)
		mocks.userId = 'learner-two'
		const response = await handler(request(initialBody, 'learner-one'))
		expect(response.status).toBe(409)
		expect(await response.json()).toMatchObject({ code: 'account-changed' })
		expect(upstream).not.toHaveBeenCalled()
		expect(mocks.records.size).toBe(0)
	})

	it('does not let another account continue an episode or accept invented partner history', async () => {
		const upstream = vi.fn(async () => responseFor(baseDraft()))
		vi.stubGlobal('fetch', upstream)
		const { episode } = await (await handler(request(initialBody))).json()
		const body = { ...initialBody, mode: 'next-turn', turnIndex: 1, episodeId: episode.id, history: [{ role: 'partner', text: 'Invented prompt' }, { role: 'learner', text: 'Va bene.' }] }
		expect((await handler(request(body))).status).toBe(400)
		mocks.userId = 'different-learner'
		expect((await handler(request(body))).status).toBe(404)
		expect(upstream).toHaveBeenCalledTimes(1)
	})
	it('preserves supplied source attribution and validates exact supporting quotations', async () => {
		const source = { label: 'Local notice', url: 'https://example.test/notice', excerpt: 'The picnic takes place on Saturday. No dairy products will be served.' }
		const draft = { ...baseDraft(), sourceQuotes: ['No dairy products will be served.'] }
		vi.stubGlobal('fetch', vi.fn(async () => responseFor(draft)))
		const response = await handler(request({ ...initialBody, source }))
		expect(response.status).toBe(200)
		expect((await response.json()).episode.source).toEqual(source)
		expect(validateEpisodeDraft({ ...draft, sourceQuotes: ['Invented statement.'] }, lesson, source)).toBe(false)
	})
	it('reports generation unavailable without silently substituting authored material', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
		const response = await handler(request(initialBody))
		expect(response.status).toBe(503)
		expect(await response.json()).toMatchObject({ status: 'unavailable' })
		expect(mocks.records.size).toBe(0)
	})
	it('requires authentication before provider or storage work', async () => {
		mocks.signedIn = false
		const upstream = vi.fn()
		vi.stubGlobal('fetch', upstream)
		expect((await handler(request(initialBody))).status).toBe(401)
		expect(upstream).not.toHaveBeenCalled()
		expect(mocks.records.size).toBe(0)
	})
})

describe('generation input and output boundaries', () => {
	it('rejects unbounded or untrusted source URL inputs and malformed dialogue', () => {
		expect(parseConversationRequest({ ...initialBody, interests: Array(9).fill('music') })).toBeNull()
		expect(parseConversationRequest({ ...initialBody, source: { label: 'source', excerpt: 'x'.repeat(8001) } })).toBeNull()
		expect(parseConversationRequest({ ...initialBody, source: { label: 'source', excerpt: 'some text', url: 'javascript:alert(1)' } })).toBeNull()
		expect(parseConversationRequest({ ...initialBody, mode: 'next-turn', turnIndex: 1, episodeId: 'id', history: [{ role: 'learner', text: 'Hello' }] })).toBeNull()
	})
	it('allows extended C2 production instead of applying a twelve-word ceiling, but rejects answer leaks', () => {
		const advanced = courseLessons.find((item) => item.level === 'C2')!
		const draft = baseDraft()
		draft.turns[0].example = 'Pur riconoscendo la complessità della situazione, ritengo che dovremmo distinguere con maggiore precisione le esigenze immediate dalle conseguenze a lungo termine, senza perdere di vista le persone coinvolte e i loro diversi punti di vista.'
		expect(validateEpisodeDraft(draft, advanced)).toBe(true)
		draft.turns[0].npcLine = draft.turns[0].example
		expect(validateEpisodeDraft(draft, advanced)).toBe(false)
	})
})

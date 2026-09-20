import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../netlify/functions/evaluate-answer'
import { courseExercise } from '../../src/learning/course-exercises'
import { courseLessons } from '../../src/learning/conversation-course'

const mocks = vi.hoisted(() => ({ setJSON: vi.fn(async () => undefined) }))
vi.mock('@netlify/blobs', () => ({ getStore: () => ({ setJSON: mocks.setJSON }) }))
vi.mock('../../netlify/functions/_shared/auth', () => ({
	requireUser: async () => ({ user: { id: 'learner' } }),
	authFailed: () => false,
}))

const result = {
	exerciseValid: true, invalidReason: '', accepted: true, communicative: true,
	correctedItalian: 'Mi passi il pane, per favore?', meaning: 'Please pass me the bread.',
	errorTags: [], shortFeedback: 'A natural alternative.', repairPrompts: [], confidence: 0.96,
}
function request() {
	return new Request('https://example.test/api/evaluate-answer', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ exercise: { id: 'request', promptEnglish: 'Please pass me the bread.', targetItalian: 'Passami il pane, per favore.' }, answer: 'Mi passi il pane, per favore?' }),
	})
}
beforeEach(() => {
	mocks.setJSON.mockClear()
	vi.stubGlobal('Netlify', { env: { get: (name: string) => name === 'OPENAI_API_KEY' ? 'sk-test-only' : undefined } })
})
afterEach(() => vi.unstubAllGlobals())

describe('semantic assessment API', () => {
	it.each([
		['provider outage', () => new Response('', { status: 503 })],
		['provider malformed JSON', () => Response.json({ output_text: '{' })],
		['missing assessment fields', () => Response.json({ output_text: JSON.stringify({ accepted: true }) })],
		['provider refusal', () => Response.json({ output: [{ content: [{ type: 'refusal', refusal: 'Unavailable' }] }] })],
	])('returns unassessed and writes no mistake after %s', async (_name, reply) => {
		vi.stubGlobal('fetch', vi.fn(async () => reply()))
		const response = await handler(request())
		expect(response.status).toBe(503)
		expect(await response.json()).toMatchObject({ status: 'unassessed' })
		expect(mocks.setJSON).not.toHaveBeenCalled()
	})
	it('accepts semantic alternatives and retains the learner wording', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({ output_text: JSON.stringify({ ...result, correctedItalian: 'Passami il pane, per favore.' }) })))
		const response = await handler(request())
		expect(response.status).toBe(200)
		expect(await response.json()).toMatchObject({ ...result, provider: 'openai', status: 'assessed' })
		expect(mocks.setJSON).not.toHaveBeenCalled()
	})
	it('forwards an open course goal and preserves an accepted opinion that differs from the example', async () => {
		const lesson = courseLessons.find((entry) => entry.level === 'A2' && entry.strandId === 'culture')!
		const exercise = courseExercise(lesson, {
			...lesson.turns[0],
			instruction: 'Give your own opinion of the film and explain why.',
		}, 'base')
		const answer = 'Non mi è piaciuto, perché era noioso.'
		// This is deliberately the opposite of the illustrative answer. The semantic
		// assessor, not a string comparison with that answer, determines acceptance.
		const upstream = vi.fn(async (_url, init) => {
			const request = JSON.parse(init.body)
			const payload = JSON.parse(request.input.find((entry: { role: string }) => entry.role === 'user').content)
			expect(payload.exercise.evaluationMode).toBe('open-goal')
			expect(payload.exercise.communicativeGoal).toContain('Give your own opinion')
			expect(payload.exercise.npcLine).toBe(lesson.turns[0].npcLine)
			expect(payload.answer).toBe(answer)
			const instruction = request.input.find((entry: { role: string }) => entry.role === 'system').content
			expect(instruction).toContain('open-goal')
			expect(instruction).toContain('details found solely in the example are optional')
			return Response.json({ output_text: JSON.stringify({ ...result, correctedItalian: exercise.targetItalian }) })
		})
		vi.stubGlobal('fetch', upstream)
		const response = await handler(new Request('https://example.test/api/evaluate-answer', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ exercise, answer }),
		}))
		expect(response.status).toBe(200)
		expect(await response.json()).toMatchObject({ accepted: true, correctedItalian: answer })
		expect(mocks.setJSON).not.toHaveBeenCalled()
	})

	it('treats an unreachable provider as unassessed, without a string-match fallback', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network failed') }))
		const response = await handler(request())
		expect(response.status).toBe(503)
		expect(mocks.setJSON).not.toHaveBeenCalled()
	})
})

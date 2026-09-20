import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../netlify/functions/transcribe-speech'
const mocks = vi.hoisted(() => ({ setJSON: vi.fn(async () => undefined) }))
vi.mock('@netlify/blobs', () => ({ getStore: () => ({ setJSON: mocks.setJSON }) }))
vi.mock('../../netlify/functions/_shared/auth', () => ({ requireUser: async () => ({ user: { id: 'learner' } }), authFailed: () => false }))
function request(size = 20, fields: Record<string, string> = {}) {
	const body = new FormData()
	body.append('audio', new Blob([new Uint8Array(size)], { type: 'audio/webm' }), 'answer.webm')
	for (const [name, value] of Object.entries(fields)) body.append(name, value)
	return new Request('https://example.test/api/transcribe-speech', { method: 'POST', body })
}
beforeEach(() => {
	mocks.setJSON.mockClear()
	vi.stubGlobal('Netlify', { env: { get: (name: string) => name === 'OPENAI_API_KEY' ? 'sk-test-only' : undefined } })
})
afterEach(() => vi.unstubAllGlobals())
describe('speech transcription boundaries', () => {
	it.each([[0, {}, 422], [20, { speechDetected: 'false' }, 422], [4 * 1024 * 1024 + 1, {}, 413]] as const)(
		'rejects unusable uploads without sending audio upstream (%s bytes)', async (size, fields, status) => {
			const fetch = vi.fn()
			vi.stubGlobal('fetch', fetch)
			expect((await handler(request(size, fields))).status).toBe(status)
			expect(fetch).not.toHaveBeenCalled()
			expect(mocks.setJSON).not.toHaveBeenCalled()
		}
	)
	it('returns unknown timings as null and keeps recognition provisional', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: 'Buongiorno.' })))
		const response = await handler(request(20, { responseLatencyMs: 'null', utteranceDurationMs: '-1' }))
		expect(await response.json()).toMatchObject({ transcript: 'Buongiorno.', responseLatencyMs: null, utteranceDurationMs: null })
		expect(mocks.setJSON).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'unconfirmed' }))
	})
	it('rejects an empty transcript without creating a speech attempt', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: ' ' })))
		expect((await handler(request())).status).toBe(422)
		expect(mocks.setJSON).not.toHaveBeenCalled()
	})
})

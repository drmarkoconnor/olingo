import { beforeEach, describe, expect, it, vi } from 'vitest'
const dependencies = vi.hoisted(() => ({ requireUser: vi.fn(), getStore: vi.fn() }))
vi.mock('../../netlify/functions/_shared/auth', () => ({ requireUser: dependencies.requireUser, authFailed: (result: object) => 'response' in result }))
vi.mock('@netlify/blobs', () => ({ getStore: dependencies.getStore }))
import handler from '../../netlify/functions/conversation-history'

beforeEach(() => { vi.clearAllMocks() })
describe('authenticated conversation history endpoint', () => {
 it('does not access cloud storage without authentication', async () => {
  dependencies.requireUser.mockResolvedValue({ response: new Response('', { status: 401 }) })
  const result = await handler(new Request('https://example.test/api/conversation-history?kind=attempts'))
  expect(result.status).toBe(401)
  expect(dependencies.getStore).not.toHaveBeenCalled()
 })
 it('rejects a stale tab for a different currently signed-in account', async () => {
  dependencies.requireUser.mockResolvedValue({ user: { id: 'bob' } })
  const result = await handler(new Request('https://example.test/api/conversation-history', { method: 'POST', headers: { 'X-Olingo-User': 'alice' }, body: '{}' }))
  expect(result.status).toBe(409)
  expect(dependencies.getStore).not.toHaveBeenCalled()
 })
 it('stores under server-verified identity even when a record supplies another owner', async () => {
  dependencies.requireUser.mockResolvedValue({ user: { id: 'alice' } })
  const setJSON = vi.fn(async () => ({ modified: true }))
  dependencies.getStore.mockReturnValue({ setJSON })
  const attempt = { id: 'one', userId: 'bob', contextId: 'generated-episode-1', lessonId: 'lesson', turnId: 'turn', variant: 'base', accepted: true, communicative: true, spoken: true, hintsUsed: 0, atISO: '2026-08-01T09:00:00Z', flow: 'fluent' }
  const result = await handler(new Request('https://example.test/api/conversation-history', { method: 'POST', headers: { 'X-Olingo-User': 'alice' }, body: JSON.stringify({ attempts: [attempt] }) }))
  expect(result.status).toBe(200)
  expect(setJSON.mock.calls[0][1]).toMatchObject({ userId: 'alice', contextId: 'generated-episode-1' })
  expect(dependencies.getStore).toHaveBeenCalledWith({ name: 'conversation-history-v1', consistency: 'strong' })
 })
})

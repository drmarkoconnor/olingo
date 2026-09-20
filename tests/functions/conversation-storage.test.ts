import { describe, expect, it } from 'vitest'
import { normaliseAttempt, readHistoryPage, storeHistoryBatch, type HistoryStore } from '../../netlify/functions/_shared/conversation-storage'

function memoryStore() {
 const data = new Map<string, unknown>()
 const conditional: boolean[] = []
 const api = {
  async get(key: string) { return data.get(key) ?? null },
  async setJSON(key: string, value: unknown, options: { onlyIfNew?: boolean }) {
   conditional.push(options.onlyIfNew === true)
   if (options.onlyIfNew && data.has(key)) return { modified: false }
   data.set(key, structuredClone(value)); return { modified: true }
  },
  async *list(options: { prefix: string; paginate: boolean }) {
   const all = [...data.keys()].filter(key => key.startsWith(options.prefix)).reverse()
   for (let i = 0; i < all.length; i += 17) yield { blobs: all.slice(i, i + 17).map(key => ({ key, etag: key })), directories: [] }
  },
 }
 return { data, conditional, store: api as unknown as HistoryStore }
}
const attempt = (id = 'one') => ({ id, userId: 'spoofed', lessonId: 'lesson', turnId: 'turn', variant: 'base', accepted: true, communicative: true, spoken: true, hintsUsed: 0, atISO: '2026-08-01T09:00:00Z', flow: 'fluent' })
const document = (revisionId: string, updatedAt = '2026-08-01T09:00:00Z') => ({ id: 'run-1', revisionId, userId: 'spoofed', kind: 'run', updatedAt, payload: { turn: 1 } })

describe('durable conversation history storage', () => {
 it('derives ownership from the verified user and makes duplicate attempts immutable', async () => {
  const { store, conditional } = memoryStore()
  await storeHistoryBatch(store, 'alice', [attempt()], [])
  const retry = await storeHistoryBatch(store, 'alice', [{ ...attempt(), accepted: false }], [])
  expect(retry.attempts[0]).toMatchObject({ userId: 'alice', accepted: true })
  expect((await readHistoryPage(store, 'bob', 'attempts')).records).toHaveLength(0)
  expect(conditional.every(Boolean)).toBe(true)
 })
 it('preserves concurrent attempt events and independent checkpoint revisions', async () => {
  const { store } = memoryStore()
  await Promise.all([
   storeHistoryBatch(store, 'alice', [attempt('first')], [document('revision-a')]),
   storeHistoryBatch(store, 'alice', [attempt('second')], [document('revision-b')]),
  ])
  expect((await readHistoryPage(store, 'alice', 'attempts')).records).toHaveLength(2)
  expect((await readHistoryPage(store, 'alice', 'documents')).records).toHaveLength(2)
 })
 it('returns all history across bounded pages without relying on list order', async () => {
  const { store } = memoryStore()
  await storeHistoryBatch(store, 'alice', Array.from({ length: 50 }, (_, i) => attempt(`a-${i}`)), [])
  await storeHistoryBatch(store, 'alice', Array.from({ length: 14 }, (_, i) => attempt(`b-${i}`)), [])
  const page1 = await readHistoryPage(store, 'alice', 'attempts')
  const page2 = await readHistoryPage(store, 'alice', 'attempts', page1.nextCursor)
  expect(page1.records).toHaveLength(50)
  expect(page2.records).toHaveLength(14)
  expect(page2.nextCursor).toBeNull()
  expect(new Set([...page1.records, ...page2.records].map((value: any) => value.id)).size).toBe(64)
  await expect(readHistoryPage(store, 'bob', 'attempts', page1.nextCursor)).rejects.toThrow('cursor')
  await expect(readHistoryPage(store, 'alice', 'documents', page1.nextCursor)).rejects.toThrow('cursor')
 })
 it('round-trips measured speech evidence without inventing missing timing', async () => {
  const { store } = memoryStore()
  const speechEvidence = { rawTranscript: 'come sta', confirmedTranscript: 'Come stai?', recordingDurationMs: 5200, speechOnsetMs: null, utteranceDurationMs: null, timingBasis: 'recording-start' }
  await storeHistoryBatch(store, 'alice', [{ ...attempt(), speechEvidence }], [])
  const [saved] = (await readHistoryPage(store, 'alice', 'attempts')).records as any[]
  expect(saved.speechEvidence).toEqual(speechEvidence)
  expect(normaliseAttempt(attempt('legacy'), 'alice').speechEvidence).toBeUndefined()
  const measured = { ...speechEvidence, speechOnsetMs: 700, utteranceDurationMs: 3500 }
  expect(normaliseAttempt({ ...attempt(), speechEvidence: measured }, 'alice').speechEvidence).toEqual(measured)
 })
 it.each([
  { recordingDurationMs: -1 }, { recordingDurationMs: Infinity }, { recordingDurationMs: 900_000 },
  { speechOnsetMs: -1 }, { speechOnsetMs: 6000 }, { utteranceDurationMs: Number.NaN },
  { timingBasis: 'prompt-start' }, { rawTranscript: 123 }, { confirmedTranscript: null },
 ])('rejects malformed or misleading speech timing %j', patch => {
  const speechEvidence = { rawTranscript: '', confirmedTranscript: 'Ciao', recordingDurationMs: 5200, speechOnsetMs: null, utteranceDurationMs: null, timingBasis: 'recording-start', ...patch }
  expect(() => normaliseAttempt({ ...attempt(), speechEvidence }, 'alice')).toThrow('Invalid')
 })
 it('validates the entire batch before writing and rejects future practice dates', async () => {
  const { store, data } = memoryStore()
  await expect(storeHistoryBatch(store, 'alice', [attempt(), { ...attempt('bad'), atISO: '2099-01-01' }], [])).rejects.toThrow('Invalid')
  expect(data.size).toBe(0)
  expect(() => normaliseAttempt({ ...attempt(), hintsUsed: -1 }, 'alice')).toThrow('Invalid')
 })
})

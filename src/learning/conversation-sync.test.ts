import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/storage/db'
import { exportConversationHistory, loadConversationDocuments, mergeConversationRecords, saveConversationDocument, syncConversationHistory, type ConversationDocument } from './conversation-sync'
import type { CourseAttempt } from './course-progress'

const attempt: CourseAttempt & { userId: string } = { id: 'attempt-a', userId: 'alice', lessonId: 'lesson', turnId: 'turn', variant: 'base', accepted: true, communicative: true, spoken: true, hintsUsed: 0, atISO: '2026-08-01T09:00:00Z', flow: 'fluent' }
const stamp = '2026-08-02T09:00:00Z'
const remoteDoc: ConversationDocument = { userId: 'alice', kind: 'run', id: 'run-one', revisionId: 'remote', updatedAt: '2026-08-01T09:00:00Z', payload: { turn: 1 } }
beforeEach(async () => { await db.delete(); await db.open() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('conversation history sync', () => {
 it('merges repeated remote evidence without regrading or incrementing mastery', async () => {
  await mergeConversationRecords('alice', [attempt], [], stamp)
  await mergeConversationRecords('alice', [attempt], [], stamp)
  expect(await db.courseAttempts.count()).toBe(1)
  expect(await db.exerciseLogs.count()).toBe(0)
  expect(await db.skillAttempts.count()).toBe(0)
  expect((await db.courseAttempts.get(attempt.id))?.syncedAt).toBe(stamp)
 })
 it('rejects records belonging to another learner atomically', async () => {
  await expect(mergeConversationRecords('alice', [attempt, { ...attempt, id: 'other', userId: 'bob' }], [], stamp)).rejects.toThrow('mismatched')
  expect(await db.courseAttempts.count()).toBe(0)
 })
 it('preserves a newer unsynced local checkpoint and resolves equal-date revisions deterministically', async () => {
  await db.conversationDocuments.put({ ...remoteDoc, revisionId: 'local-new', updatedAt: '2026-08-02T09:00:00Z', payload: { turn: 2 } })
  await mergeConversationRecords('alice', [], [remoteDoc], stamp)
  expect((await loadConversationDocuments('alice'))[0]).toMatchObject({ revisionId: 'local-new', payload: { turn: 2 } })
  expect((await loadConversationDocuments('alice'))[0].syncedAt).toBeUndefined()
  await mergeConversationRecords('alice', [], [{ ...remoteDoc, revisionId: 'z-newer', updatedAt: '2026-08-02T09:00:00Z' }], stamp)
  expect((await loadConversationDocuments('alice'))[0].revisionId).toBe('z-newer')
 })
 it('keeps pending local practice on outage and marks synced only after confirmation', async () => {
  await db.courseAttempts.add(attempt)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  const status = await syncConversationHistory('alice')
  expect(status.state).toBe('error')
  expect((await db.courseAttempts.get(attempt.id))?.syncedAt).toBeUndefined()
 })
 it('uploads legacy authored history once and downloads every remote page', async () => {
  await db.courseAttempts.add(attempt)
  const fetch = vi.fn(async (input: string, init: RequestInit) => {
   expect((init.headers as Record<string, string>)['X-Olingo-User']).toBe('alice')
   if (init.method === 'POST') return Response.json({ userId: 'alice', attempts: [attempt], documents: [], syncedAt: stamp })
   const url = new URL(input, 'https://example.test')
   if (url.searchParams.get('kind') === 'documents') return Response.json({ userId: 'alice', records: [], nextCursor: null })
   return url.searchParams.has('cursor')
    ? Response.json({ userId: 'alice', records: [{ ...attempt, id: 'page-two' }], nextCursor: null })
    : Response.json({ userId: 'alice', records: [attempt], nextCursor: 'next-page' })
  })
  vi.stubGlobal('fetch', fetch)
  expect((await syncConversationHistory('alice')).state).toBe('synced')
  expect((await syncConversationHistory('alice')).state).toBe('synced')
  expect(fetch.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
  expect(await db.courseAttempts.count()).toBe(2)
 })
 it('backs up only the requested learner and avoids duplicate unchanged checkpoint revisions', async () => {
  await db.courseAttempts.bulkAdd([attempt, { ...attempt, id: 'b', userId: 'bob' }])
  const saved = await saveConversationDocument('alice', 'profile', 'preferences', { targetLevel: 'B1' })
  const unchanged = await saveConversationDocument('alice', 'profile', 'preferences', { targetLevel: 'B1' })
  expect(unchanged.revisionId).toBe(saved.revisionId)
  const backup = await exportConversationHistory('alice')
  expect(backup.attempts).toHaveLength(1)
  expect(backup.documents).toHaveLength(1)
  expect(backup.attempts[0].userId).toBe('alice')
 })
})

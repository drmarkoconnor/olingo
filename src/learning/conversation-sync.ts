import { db } from '@/storage/db'
import { apiFetch } from '@/lib/api'
import type { CourseAttempt } from '@/learning/course-progress'

export interface ConversationDocument {
 userId: string
 kind: 'run' | 'episode' | 'profile'
 id: string
 revisionId: string
 updatedAt: string
 payload: Record<string, unknown>
 syncedAt?: string
}
export interface ConversationSyncStatus {
 state: 'idle' | 'syncing' | 'synced' | 'offline' | 'unauthenticated' | 'error'
 message: string
 syncedAt?: string
}
export const conversationChangedEvent = 'olingo:conversation-changed'
function announce(userId: string, source: 'local' | 'remote') {
 if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(conversationChangedEvent, { detail: { userId, source } }))
}
const inFlight = new Map<string, Promise<ConversationSyncStatus>>()
const rerunRequested = new Set<string>()
const observerSets = new Map<string, Set<(status: ConversationSyncStatus) => void>>()
function broadcast(userId: string, status: ConversationSyncStatus) { observerSets.get(userId)?.forEach(listener => listener(status)); return status }
function newer(incoming: ConversationDocument, current: ConversationDocument) {
 return incoming.updatedAt > current.updatedAt || (incoming.updatedAt === current.updatedAt && incoming.revisionId > current.revisionId)
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }

export async function saveConversationDocument(userId: string, kind: ConversationDocument['kind'], id: string, payload: Record<string, unknown>) {
 if (!userId || ['loading', 'signed-out'].includes(userId)) throw new Error('Choose a learner before saving conversation progress.')
 const existing = await db.conversationDocuments.get([userId, kind, id])
 if (existing && JSON.stringify(existing.payload) === JSON.stringify(payload)) return existing
 const next: ConversationDocument = { userId, kind, id, revisionId: crypto.randomUUID(), updatedAt: new Date().toISOString(), payload }
 await db.conversationDocuments.put(next)
 announce(userId, 'local')
 return next
}
export function loadConversationDocuments(userId: string, kind?: ConversationDocument['kind']) {
 return db.conversationDocuments.where('userId').equals(userId).filter(item => !kind || item.kind === kind).toArray()
}

class SyncError extends Error {
 constructor(message: string, readonly status = 0) { super(message) }
}
async function request(userId: string, path: string, init: RequestInit = {}) {
 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), 25_000)
 try {
  const response = await apiFetch(path, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-Olingo-User': userId, ...init.headers } })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new SyncError(record(data) && typeof data.error === 'string' ? data.error : 'Cloud history could not be synced.', response.status)
  if (!record(data) || data.userId !== userId) throw new SyncError('The signed-in learner changed. Refresh before syncing.', 409)
  return data
 } finally { clearTimeout(timeout) }
}

/** Import canonical remote evidence without replaying grading or incrementing skill mastery. */
export async function mergeConversationRecords(userId: string, attempts: unknown[], documents: unknown[], syncedAt: string) {
 await db.transaction('rw', db.courseAttempts, db.conversationDocuments, async () => {
  for (const value of attempts) {
   if (!record(value) || value.userId !== userId || typeof value.id !== 'string' || typeof value.lessonId !== 'string' || typeof value.turnId !== 'string' ||
    typeof value.accepted !== 'boolean' || typeof value.communicative !== 'boolean' || typeof value.spoken !== 'boolean' ||
    typeof value.atISO !== 'string' || !Number.isFinite(Date.parse(value.atISO)) || Date.parse(value.atISO) > Date.now()) throw new SyncError('Cloud history contains an invalid or mismatched learner record.')
   const existing = await db.courseAttempts.get(value.id)
   if (existing && existing.userId !== userId) throw new SyncError('A local history identifier belongs to a different learner.')
   // The remote event is immutable and wins on ID collision; it is never marked again.
   await db.courseAttempts.put({ ...value, userId, syncedAt } as CourseAttempt & { userId: string })
  }
  for (const value of documents) {
   if (!record(value) || value.userId !== userId || typeof value.id !== 'string' || typeof value.revisionId !== 'string' ||
    !['run', 'episode', 'profile'].includes(String(value.kind)) || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
    Date.parse(value.updatedAt) > Date.now() || !record(value.payload)) throw new SyncError('Cloud history contains an invalid conversation document.')
   const incoming = { ...value, userId, syncedAt } as ConversationDocument
   const current = await db.conversationDocuments.get([userId, incoming.kind, incoming.id])
   if (!current || current.revisionId === incoming.revisionId || newer(incoming, current)) await db.conversationDocuments.put(incoming)
  }
 })
}

async function performSync(userId: string): Promise<ConversationSyncStatus> {
 if (!userId || ['signed-out', 'loading'].includes(userId)) return broadcast(userId, { state: 'unauthenticated', message: 'Sign in to sync conversation history. Local practice remains on this device.' })
 if (typeof navigator !== 'undefined' && navigator.onLine === false) return broadcast(userId, { state: 'offline', message: 'Offline. Your practice is saved on this device and will sync when connected.' })
 broadcast(userId, { state: 'syncing', message: 'Syncing conversation history…' })
 try {
  const pendingAttempts = await db.courseAttempts.where('userId').equals(userId).filter(item => !item.syncedAt).toArray()
  const pendingDocuments = await db.conversationDocuments.where('userId').equals(userId).filter(item => !item.syncedAt).toArray()
  // Smaller payload batches also keep long advanced replies below function body limits.
  for (let index = 0; index < pendingAttempts.length; index += 15) {
   const batch = pendingAttempts.slice(index, index + 15)
   const data = await request(userId, '/api/conversation-history', { method: 'POST', body: JSON.stringify({ attempts: batch, documents: [] }) })
   if (!Array.isArray(data.attempts) || !Array.isArray(data.documents)) throw new SyncError('The server did not confirm the saved records.')
   const acknowledged = data.attempts
   if (acknowledged.length !== batch.length || batch.some(item => !acknowledged.some((saved: any) => saved.id === item.id))) throw new SyncError('The server did not acknowledge every attempt. Retry sync.')
   await mergeConversationRecords(userId, data.attempts, data.documents, String(data.syncedAt ?? new Date().toISOString()))
  }
  for (let index = 0; index < pendingDocuments.length; index += 5) {
   const batch = pendingDocuments.slice(index, index + 5)
   const data = await request(userId, '/api/conversation-history', { method: 'POST', body: JSON.stringify({ attempts: [], documents: batch }) })
   if (!Array.isArray(data.attempts) || !Array.isArray(data.documents)) throw new SyncError('The server did not confirm the saved records.')
   const acknowledged = data.documents
   if (acknowledged.length !== batch.length || batch.some(item => !acknowledged.some((saved: any) => saved.revisionId === item.revisionId && saved.id === item.id))) throw new SyncError('The server did not acknowledge every checkpoint. Retry sync.')
   await mergeConversationRecords(userId, data.attempts, data.documents, String(data.syncedAt ?? new Date().toISOString()))
  }
  for (const kind of ['attempts', 'documents'] as const) {
   let cursor: string | null = null
   const seen = new Set<string>()
   do {
    const data = await request(userId, `/api/conversation-history?kind=${kind}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    if (!Array.isArray(data.records) || (data.nextCursor !== null && typeof data.nextCursor !== 'string')) throw new SyncError('Cloud history returned an incomplete page.')
    await mergeConversationRecords(userId, kind === 'attempts' ? data.records : [], kind === 'documents' ? data.records : [], new Date().toISOString())
    cursor = data.nextCursor as string | null
    if (cursor) { if (seen.has(cursor)) throw new SyncError('Cloud history paging stalled. Your local history is safe.'); seen.add(cursor) }
   } while (cursor)
  }
  const stillPending = (await db.courseAttempts.where('userId').equals(userId).filter(item => !item.syncedAt).count()) + (await db.conversationDocuments.where('userId').equals(userId).filter(item => !item.syncedAt).count())
  if (stillPending) {
   rerunRequested.add(userId)
   announce(userId, 'remote')
   return broadcast(userId, { state: 'syncing', message: 'Syncing your newest practice…' })
  }
  const status: ConversationSyncStatus = { state: 'synced', message: 'Conversation history synced to your account.', syncedAt: new Date().toISOString() }
  announce(userId, 'remote')
  return broadcast(userId, status)
 } catch (cause) {
  const unauthenticated = cause instanceof SyncError && [401, 403, 409].includes(cause.status)
  return broadcast(userId, { state: unauthenticated ? 'unauthenticated' : typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error', message: unauthenticated ? 'Sign in again before syncing. Your local practice is safe.' : `${cause instanceof Error ? cause.message : 'Sync is unavailable.'} Your local practice is kept; sync will retry.` })
 }
}
export function syncConversationHistory(userId: string): Promise<ConversationSyncStatus> {
 const existing = inFlight.get(userId)
 if (existing) { rerunRequested.add(userId); return existing }
 const pending = performSync(userId).finally(() => {
  inFlight.delete(userId)
  if (rerunRequested.delete(userId)) void syncConversationHistory(userId)
 })
 inFlight.set(userId, pending)
 return pending
}
export function watchConversationSync(userId: string, onStatus: (status: ConversationSyncStatus) => void) {
 const observers = observerSets.get(userId) ?? new Set()
 observers.add(onStatus); observerSets.set(userId, observers)
 const sync = () => { void syncConversationHistory(userId) }
 const change = (event: Event) => {
  const detail = (event as CustomEvent).detail
  if (detail?.userId === userId && detail?.source === 'local') sync()
 }
 sync()
 if (typeof window !== 'undefined') {
  window.addEventListener('online', sync); window.addEventListener('focus', sync); window.addEventListener(conversationChangedEvent, change)
 }
 const interval = setInterval(sync, 5 * 60_000)
 return () => {
  clearInterval(interval); observers.delete(onStatus)
  if (!observers.size) observerSets.delete(userId)
  if (typeof window !== 'undefined') { window.removeEventListener('online', sync); window.removeEventListener('focus', sync); window.removeEventListener(conversationChangedEvent, change) }
 }
}

/** Complete local backup; run sync first to include all remote pages when online. No audio is exported. */
export async function exportConversationHistory(userId: string) {
 return {
  format: 'olingo-conversation-history', version: 1, userId, exportedAt: new Date().toISOString(),
  attempts: await db.courseAttempts.where('userId').equals(userId).toArray(),
  documents: await loadConversationDocuments(userId),
 }
}

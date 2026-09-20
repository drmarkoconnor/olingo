import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { CourseAttempt } from '../../../src/learning/course-progress'
import type { ConversationDocument } from '../../../src/learning/conversation-sync'

export type HistoryKind = 'attempts' | 'documents'
type StoredAttempt = CourseAttempt & { userId: string }
export type HistoryStore = Pick<ReturnType<typeof getStore>, 'get' | 'setJSON' | 'list'>
export function conversationStore() { return getStore({ name: 'conversation-history-v1', consistency: 'strong' }) }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const prefix = (userId: string, kind: HistoryKind) => `users/${hash(userId)}/${kind}/`
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value: unknown, max = 500) => typeof value === 'string' && value.length > 0 && value.length <= max
const date = (value: unknown, now: number) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now

function normaliseSpeechEvidence(value: unknown): NonNullable<CourseAttempt['speechEvidence']> {
 if (!object(value) || typeof value.rawTranscript !== 'string' || value.rawTranscript.length > 12_000 ||
  typeof value.confirmedTranscript !== 'string' || value.confirmedTranscript.length > 12_000 ||
  value.timingBasis !== 'recording-start' || typeof value.recordingDurationMs !== 'number' ||
  !Number.isFinite(value.recordingDurationMs) || value.recordingDurationMs < 0 || value.recordingDurationMs > 600_000) throw new Error('Invalid recorded speech evidence.')
 const duration = value.recordingDurationMs
 const timing = (measurement: unknown) => measurement === null || (typeof measurement === 'number' && Number.isFinite(measurement) && measurement >= 0 && measurement <= duration)
 if (!timing(value.speechOnsetMs) || !timing(value.utteranceDurationMs)) throw new Error('Invalid recorded speech timing.')
 return {
  rawTranscript: value.rawTranscript, confirmedTranscript: value.confirmedTranscript,
  recordingDurationMs: duration, speechOnsetMs: value.speechOnsetMs as number | null,
  utteranceDurationMs: value.utteranceDurationMs as number | null, timingBasis: 'recording-start',
 }
}

/** Transport validation is not a claim to independently certify client-imported learning scores. */
export function normaliseAttempt(value: unknown, userId: string, now = Date.now()): StoredAttempt {
 if (!object(value) || !text(value.id) || !text(value.lessonId) || !text(value.turnId) ||
  !['base', 'transfer'].includes(String(value.variant)) || typeof value.accepted !== 'boolean' ||
  typeof value.communicative !== 'boolean' || typeof value.spoken !== 'boolean' ||
  !Number.isInteger(value.hintsUsed) || Number(value.hintsUsed) < 0 || Number(value.hintsUsed) > 100 ||
  !date(value.atISO, now) || !['fluent', 'hesitant', 'rebuilt', 'unreported'].includes(String(value.flow))) throw new Error('Invalid conversation attempt.')
 if (JSON.stringify(value).length > 35_000) throw new Error('Conversation attempt is too large.')
 const attempt: StoredAttempt = {
  id: value.id as string, userId, lessonId: value.lessonId as string, turnId: value.turnId as string,
  variant: value.variant as CourseAttempt['variant'], accepted: value.accepted, communicative: value.communicative,
  spoken: value.spoken, hintsUsed: Number(value.hintsUsed), atISO: new Date(value.atISO as string).toISOString(), flow: value.flow as CourseAttempt['flow'],
 }
 if (text(value.runId)) attempt.runId = value.runId as string
 if (text(value.contextId)) attempt.contextId = value.contextId as string
 if (typeof value.answer === 'string' && value.answer.length <= 12_000) attempt.answer = value.answer
 if (object(value.assessment)) attempt.assessment = value.assessment as unknown as CourseAttempt['assessment']
 if (value.speechEvidence !== undefined) {
  if (!value.spoken) throw new Error('Invalid speech evidence on a typed answer.')
  attempt.speechEvidence = normaliseSpeechEvidence(value.speechEvidence)
 }
 return attempt
}

export function normaliseDocument(value: unknown, userId: string, now = Date.now()): ConversationDocument {
 if (!object(value) || !text(value.id) || !text(value.revisionId) || !['run', 'episode', 'profile'].includes(String(value.kind)) ||
  !date(value.updatedAt, now) || !object(value.payload) || JSON.stringify(value.payload).length > 100_000) throw new Error('Invalid conversation document.')
 return { userId, id: value.id as string, revisionId: value.revisionId as string, kind: value.kind as ConversationDocument['kind'], updatedAt: new Date(value.updatedAt as string).toISOString(), payload: value.payload }
}

export async function storeHistoryBatch(store: HistoryStore, userId: string, attempts: unknown[], documents: unknown[], now = Date.now()) {
 if (attempts.length + documents.length > 50) throw new Error('Sync at most 50 records at a time.')
 // Validate the whole batch before any writes. Partial network failures remain safely retryable.
 const cleanAttempts = attempts.map(value => normaliseAttempt(value, userId, now))
 const cleanDocuments = documents.map(value => normaliseDocument(value, userId, now))
 const canonicalAttempts: StoredAttempt[] = []
 const canonicalDocuments: ConversationDocument[] = []
 for (const attempt of cleanAttempts) {
  const key = `${prefix(userId, 'attempts')}${hash(attempt.id)}`
  const result = await store.setJSON(key, attempt, { onlyIfNew: true })
  canonicalAttempts.push(result.modified ? attempt : await store.get(key, { type: 'json' }))
 }
 for (const document of cleanDocuments) {
  // Independent immutable revisions preserve simultaneous updates from different devices.
  const key = `${prefix(userId, 'documents')}${hash(`${document.kind}:${document.id}:${document.revisionId}`)}`
  const result = await store.setJSON(key, document, { onlyIfNew: true })
  canonicalDocuments.push(result.modified ? document : await store.get(key, { type: 'json' }))
 }
 return { attempts: canonicalAttempts, documents: canonicalDocuments }
}

export async function readHistoryPage(store: HistoryStore, userId: string, kind: HistoryKind, cursor?: string | null) {
 const scopedPrefix = prefix(userId, kind)
 let after = ''
 if (cursor) {
  try {
   const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
   if (decoded.scope !== scopedPrefix || !text(decoded.after, 600) || !decoded.after.startsWith(scopedPrefix)) throw new Error()
   after = decoded.after
  } catch { throw new Error('Invalid history cursor.') }
 }
 // The SDK exposes an async page iterator, not a public resumable cursor argument.
 // Keep only the next 51 keys while scanning its pages; payloads are bounded to 50.
 let nextKeys: string[] = []
 for await (const page of store.list({ prefix: scopedPrefix, paginate: true })) {
  nextKeys = [...nextKeys, ...page.blobs.map(blob => blob.key).filter(key => key.startsWith(scopedPrefix) && key > after)].sort().slice(0, 51)
 }
 const keys = nextKeys.slice(0, 50)
 const records: unknown[] = []
 for (let index = 0; index < keys.length; index += 10) {
  const values = await Promise.all(keys.slice(index, index + 10).map(key => store.get(key, { type: 'json' })))
  records.push(...values.filter(value => value && value.userId === userId))
 }
 const nextCursor = nextKeys.length > 50 ? Buffer.from(JSON.stringify({ scope: scopedPrefix, after: keys[keys.length - 1] })).toString('base64url') : null
 return { records, nextCursor }
}

import { authFailed, requireUser } from './_shared/auth'
import { json, methodNotAllowed } from './_shared/http'
import { conversationStore, readHistoryPage, storeHistoryBatch, type HistoryKind } from './_shared/conversation-storage'

export default async function handler(req: Request) {
 if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed()
 const auth = await requireUser()
 if (authFailed(auth)) return auth.response
 // Reject a tab whose identity changed while its local sync was in flight. This header
 // never selects the storage owner; the verified server session always does.
 if (req.headers.get('X-Olingo-User') !== auth.user.id) return json({ error: 'The signed-in learner changed. Refresh before syncing.' }, { status: 409 })
 try {
  const store = conversationStore()
  if (req.method === 'GET') {
   const url = new URL(req.url)
   const kind = url.searchParams.get('kind')
   if (kind !== 'attempts' && kind !== 'documents') return json({ error: 'Choose attempts or documents.' }, { status: 400 })
   const page = await readHistoryPage(store, auth.user.id, kind as HistoryKind, url.searchParams.get('cursor'))
   return json({ ...page, userId: auth.user.id })
  }
  const bodyText = await req.text()
  if (bodyText.length > 1_000_000) return json({ error: 'Sync request is too large.' }, { status: 413 })
  let body: { attempts?: unknown[]; documents?: unknown[] }
  try { body = JSON.parse(bodyText) } catch { return json({ error: 'Invalid sync request.' }, { status: 400 }) }
  if (!body || !Array.isArray(body.attempts ?? []) || !Array.isArray(body.documents ?? [])) return json({ error: 'Invalid sync records.' }, { status: 400 })
  const saved = await storeHistoryBatch(store, auth.user.id, body.attempts ?? [], body.documents ?? [])
  return json({ ...saved, userId: auth.user.id, syncedAt: new Date().toISOString() })
 } catch (cause) {
  const message = cause instanceof Error ? cause.message : ''
  const invalid = /^(Invalid |Conversation attempt is too large|Sync at most)/.test(message)
  return json({ error: invalid ? message : 'Cloud history is unavailable. Your local practice is safe; retry shortly.' }, { status: invalid ? 400 : 503 })
 }
}
export const config = { path: '/api/conversation-history' }

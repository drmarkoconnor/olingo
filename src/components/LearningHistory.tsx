import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '@/storage/db'
import type { CourseAttempt } from '@/learning/course-progress'
import { loadConversationDocuments, watchConversationSync, syncConversationHistory, type ConversationDocument, type ConversationSyncStatus } from '@/learning/conversation-sync'
import { shouldApplyLearnerProfile } from '@/learning/learner-profile'
import { applyUserSettings, getSettingsSnapshot } from '@/store/useSettings'

type History = {
 userId: string
 attempts: CourseAttempt[]
 documents: ConversationDocument[]
 ready: boolean
 localMode: boolean
 status: ConversationSyncStatus
 refresh: () => Promise<void>
 retry: () => Promise<void>
}
const HistoryContext = createContext<History | null>(null)
export function LearningHistoryProvider({ userId, localMode, children }: { userId: string; localMode: boolean; children: ReactNode }) {
 const [attempts, setAttempts] = useState<CourseAttempt[]>([])
 const [documents, setDocuments] = useState<ConversationDocument[]>([])
 const [ready, setReady] = useState(false)
 const [status, setStatus] = useState<ConversationSyncStatus>({ state: 'idle', message: localMode ? 'Practice saved on this device.' : 'Opening your learning history…' })
 const appliedProfile = useRef<ConversationDocument | null>(null)
 const refreshRevision = useRef(0)
 const refresh = useCallback(async () => {
  const revision = ++refreshRevision.current
  const [history, runs, episodes, profiles] = await Promise.all([
   db.courseAttempts.where('userId').equals(userId).toArray(),
   loadConversationDocuments(userId, 'run'), loadConversationDocuments(userId, 'episode'), loadConversationDocuments(userId, 'profile'),
  ])
  if (revision !== refreshRevision.current) return
  setAttempts(history)
  setDocuments([...runs, ...episodes, ...profiles])
  const profile = profiles.find(item => item.id === 'learner')
  if (shouldApplyLearnerProfile(appliedProfile.current, profile, userId) && applyUserSettings(userId, { ...getSettingsSnapshot(), targetLevel: profile.payload.targetLevel })) appliedProfile.current = profile
 }, [userId])
 useEffect(() => {
  let active = true
  const reload = () => { if (active) void refresh().catch(() => setStatus({ state: 'error', message: 'Your local learning history could not be read. Please reload.' })) }
  const change = (event: Event) => { if ((event as CustomEvent).detail?.userId === userId) reload() }
  window.addEventListener('olingo:conversation-changed', change)
  reload()
  let stop = () => undefined as void
  if (localMode) { void refresh().then(() => { if (active) setReady(true) }).catch(() => { if (active) setReady(true) }) }
  else stop = watchConversationSync(userId, next => {
   if (!active) return
   setStatus(next)
   if (next.state !== 'syncing' && next.state !== 'idle') void refresh().finally(() => { if (active) setReady(true) }).catch(() => undefined)
  })
  return () => { active = false; ++refreshRevision.current; stop(); window.removeEventListener('olingo:conversation-changed', change) }
 }, [userId, localMode, refresh])
 async function retry() {
  if (localMode) { await refresh(); return }
  setStatus(await syncConversationHistory(userId)); await refresh()
 }
 return <HistoryContext.Provider value={{ userId, attempts, documents, ready, localMode, status, refresh, retry }}>{children}</HistoryContext.Provider>
}
export function useLearningHistory() {
 const value = useContext(HistoryContext)
 if (!value) throw new Error('Learning history must be opened inside a learner session.')
 return value
}

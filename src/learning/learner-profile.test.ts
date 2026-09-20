import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/storage/db'
import { patchLearnerProfile, saveLearnerTargetLevel, shouldApplyLearnerProfile } from './learner-profile'
import { conversationChangedEvent, type ConversationDocument } from './conversation-sync'

const profile: ConversationDocument = { userId: 'mark', kind: 'profile', id: 'learner', revisionId: 'a', updatedAt: '2026-09-20T10:00:00.000Z', payload: { targetLevel: 'B1', interests: ['jazz', 'gardening'] } }
beforeEach(async () => { await db.delete(); await db.open() })
afterEach(() => vi.unstubAllGlobals())
describe('learner level persistence', () => {
	it('does not reapply the same or an older profile on unrelated history refreshes', () => {
		expect(shouldApplyLearnerProfile(null, profile, 'mark')).toBe(true)
		expect(shouldApplyLearnerProfile(profile, { ...profile, syncedAt: '2026-09-20T11:00:00Z' }, 'mark')).toBe(false)
		expect(shouldApplyLearnerProfile(profile, { ...profile, revisionId: 'z', updatedAt: '2026-09-19T10:00:00Z' }, 'mark')).toBe(false)
		expect(shouldApplyLearnerProfile(profile, { ...profile, revisionId: 'b', updatedAt: '2026-09-21T10:00:00Z' }, 'mark')).toBe(true)
		expect(shouldApplyLearnerProfile(null, profile, 'ann')).toBe(false)
	})
	it('patches the current profile rather than replacing interests with a stale screen snapshot', async () => {
		await db.conversationDocuments.put({ ...profile, payload: { targetLevel: 'B1', interests: ['music', 'woodworking'], other: true } })
		const saved = await saveLearnerTargetLevel('mark', 'A2', () => true)
		expect(saved?.payload).toEqual({ targetLevel: 'A2', interests: ['music', 'woodworking'], other: true })
		expect(saved?.revisionId).not.toBe(profile.revisionId)
	})
	it('keeps independent concurrent interests and level edits', async () => {
		await db.conversationDocuments.put(profile)
		await Promise.all([
			patchLearnerProfile('mark', { targetLevel: 'B2' }, () => true),
			patchLearnerProfile('mark', { interests: ['music', ' music ', 'woodwork'] }, () => true),
		])
		const saved = await db.conversationDocuments.get(['mark', 'profile', 'learner'])
		expect(saved?.payload).toEqual({ targetLevel: 'B2', interests: ['music', 'woodwork'] })
	})
	it('announces only after commit so listeners can read attempts and the new profile', async () => {
		const events = new EventTarget()
		vi.stubGlobal('window', events)
		let observed: Promise<unknown[]> | undefined
		events.addEventListener(conversationChangedEvent, () => {
			observed = Promise.all([db.courseAttempts.toArray(), db.conversationDocuments.get(['mark', 'profile', 'learner'])])
		})
		await patchLearnerProfile('mark', { targetLevel: 'A2' }, () => true)
		expect(observed).toBeDefined()
		const records = await observed!
		expect(records[0]).toEqual([])
		expect((records[1] as ConversationDocument).payload.targetLevel).toBe('A2')
	})
	it('does not persist an edit after the learner changed', async () => {
		await db.conversationDocuments.put(profile)
		await saveLearnerTargetLevel('mark', 'C2', () => false)
		expect((await db.conversationDocuments.get(['mark', 'profile', 'learner']))?.payload.targetLevel).toBe('B1')
	})
})

import { cefrLevels, type CefrLevel } from '@/learning/content'
import { db } from '@/storage/db'
import { conversationChangedEvent, type ConversationDocument } from '@/learning/conversation-sync'

/** Ignore old refreshes and duplicate sync acknowledgements; only a new profile revision applies. */
export function shouldApplyLearnerProfile(previous: ConversationDocument | null, incoming: ConversationDocument | undefined, userId: string): incoming is ConversationDocument {
	if (!incoming || incoming.userId !== userId || incoming.kind !== 'profile' || incoming.id !== 'learner' || !cefrLevels.includes(incoming.payload.targetLevel as CefrLevel)) return false
	if (!previous || previous.userId !== userId) return true
	if (incoming.revisionId === previous.revisionId) return false
	return incoming.updatedAt > previous.updatedAt || (incoming.updatedAt === previous.updatedAt && incoming.revisionId > previous.revisionId)
}

export interface LearnerProfilePatch {
	targetLevel?: CefrLevel
	interests?: string[]
}

/** Patch the latest stored profile, never a screen's potentially stale document snapshot. */
export async function patchLearnerProfile(userId: string, patch: LearnerProfilePatch, isCurrentUser: () => boolean) {
	if (!userId || ['signed-out', 'loading'].includes(userId) || !isCurrentUser()) return null
	const changes: Record<string, unknown> = {}
	if (patch.targetLevel !== undefined) {
		if (!cefrLevels.includes(patch.targetLevel)) throw new Error('Choose a supported practice level.')
		changes.targetLevel = patch.targetLevel
	}
	if (patch.interests !== undefined) {
		if (!Array.isArray(patch.interests) || patch.interests.some(item => typeof item !== 'string')) throw new Error('Interests must be short text labels.')
		changes.interests = [...new Set(patch.interests.map(item => item.trim().slice(0, 60)).filter(Boolean))].slice(0, 8)
	}
	const result = await db.transaction('rw', db.conversationDocuments, async () => {
		const current = await db.conversationDocuments.get([userId, 'profile', 'learner'])
		if (!isCurrentUser()) return null
		const payload = { ...current?.payload, ...changes }
		if (current && JSON.stringify(current.payload) === JSON.stringify(payload)) return { document: current, changed: false }
		const document: ConversationDocument = {
			userId, kind: 'profile', id: 'learner', revisionId: crypto.randomUUID(),
			updatedAt: new Date().toISOString(), payload,
		}
		await db.conversationDocuments.put(document)
		return { document, changed: true }
	})
	// Notify only after commit. Subscribers query other tables and must not inherit the
	// restricted write transaction or observe a profile that could still roll back.
	if (result?.changed && typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent(conversationChangedEvent, { detail: { userId, source: 'local' } }))
	}
	return result?.document ?? null
}

export function saveLearnerTargetLevel(userId: string, targetLevel: CefrLevel, isCurrentUser: () => boolean) {
	return patchLearnerProfile(userId, { targetLevel }, isCurrentUser)
}

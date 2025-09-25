import { create } from 'zustand'
import { db, type UserCard, type Word } from '@/storage/db'

type DBState = {
	ready: boolean
	ensureUserCardsForAllWords: (userId: string) => Promise<void>
}

export const useDB = create<DBState>((set) => ({
	ready: true, // Dexie is ready instantly after construction
	ensureUserCardsForAllWords: async (userId: string) => {
		const words = await db.words.toArray()
		const existing = await db.userCards.where('userId').equals(userId).toArray()
		const existingSet = new Set(existing.map((e) => e.wordId))
		const toCreate: UserCard[] = []
		for (const w of words) {
			if (!existingSet.has(w.id)) {
				toCreate.push({
					userId,
					wordId: w.id,
					correctCount: 0,
					wrongCount: 0,
					ease: 2.3,
					intervalDays: 0,
					archived: 0,
					nextDueAt: new Date().toISOString(),
				})
			}
		}
		if (toCreate.length) await db.userCards.bulkPut(toCreate)
	},
}))


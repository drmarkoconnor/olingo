import Dexie, { Table } from 'dexie'

export type Word = {
	id: string
	italian: string
	english: string
	pos?: 'noun' | 'verb' | 'adj' | 'collocation' | string
	category?: string | null
	createdAt: string
}

export type UserCard = {
	userId: string // local uid or supabase uid
	wordId: string
	lastReviewedAt?: string | null
	nextDueAt?: string | null
	correctCount: number
	wrongCount: number
	ease: number // ease factor (SM2-like)
	intervalDays: number // last interval in days
	archived: 0 | 1 // 1 if mastered/archived
}

export type ReviewLog = {
	id?: number
	userId: string
	wordId: string
	ts: string
	correct: 0 | 1
}

export type ExerciseState = {
	userId: string
	exerciseId: string
	lastReviewedAt?: string | null
	nextDueAt?: string | null
	correctCount: number
	wrongCount: number
	ease: number
	intervalDays: number
	archived: 0 | 1
}

export type ExerciseLog = {
	id?: number
	userId: string
	exerciseId: string
	ts: string
	outcome: 'again' | 'hard' | 'good' | 'easy'
	correct: 0 | 1
	communicative?: 0 | 1
	msUsed: number
	hintsUsed: number
	conceptHintsUsed?: number
	wordBankUsed?: 0 | 1
	spokenFirst?: 0 | 1
	phase?: string
	action?: string
	mode?: string
	answer: string
}

export type MistakeItem = {
	id: string
	userId: string
	exerciseId: string
	sceneId: string
	promptEnglish: string
	userAnswer: string
	correctedItalian: string
	tags: string[]
	explanation: string
	repairPrompts?: string[]
	lastRepairAnswer?: string
	repairStep?: number
	construction?: string
	status: 'open' | 'reviewing' | 'repaired'
	nextDueAt?: string | null
	createdAt: string
	lastReviewedAt?: string | null
	attempts: number
}

export type MisspellingItem = {
	id: string
	userId: string
	word: string
	correction: string
	count: number
	firstSeenAt: string
	lastSeenAt: string
	exerciseIds: string[]
}

export type DailySessionStatus = 'active' | 'complete'
export type DailySessionActivityType =
	| 'match'
	| 'recall'
	| 'sentence'
	| 'repair'
	| 'transfer'

export type DailySession = {
	id: string
	userId: string
	dateKey: string
	programWeek: number
	dailyGoal: number
	status: DailySessionStatus
	plannedCount: number
	completedCount: number
	successCount: number
	mistakeCount: number
	activeMs: number
	revisionTags: string[]
	startedAt: string
	updatedAt: string
	completedAt?: string | null
}

export type DailySessionItem = {
	id: string
	sessionId: string
	userId: string
	dateKey: string
	type: DailySessionActivityType
	label: string
	sortOrder: number
	targetCount: number
	completedCount: number
	successCount: number
	mistakeCount: number
	activeMs: number
	status: DailySessionStatus
	tags: string[]
	startedAt?: string | null
	completedAt?: string | null
}

export class OlingoDB extends Dexie {
	words!: Table<Word, string>
	userCards!: Table<UserCard, [string, string]> // compound pk (userId+wordId)
	reviewLogs!: Table<ReviewLog, number>
	exerciseStates!: Table<ExerciseState, [string, string]>
	exerciseLogs!: Table<ExerciseLog, number>
	mistakes!: Table<MistakeItem, string>
	misspellings!: Table<MisspellingItem, string>
	dailySessions!: Table<DailySession, string>
	dailySessionItems!: Table<DailySessionItem, string>

	constructor() {
		super('olingo')
		// & = primary key, [] = compound key / index
		this.version(1).stores({
			words: '&id, italian, english, pos, category',
			userCards: '&[userId+wordId], userId, wordId, nextDueAt, archived',
			reviewLogs: '++id, userId, wordId, ts',
		})
		this.version(2).stores({
			words: '&id, italian, english, pos, category',
			userCards: '&[userId+wordId], userId, wordId, nextDueAt, archived',
			reviewLogs: '++id, userId, wordId, ts',
			exerciseStates:
				'&[userId+exerciseId], userId, exerciseId, nextDueAt, archived',
			exerciseLogs: '++id, userId, exerciseId, ts, outcome, correct',
			mistakes:
				'&id, userId, exerciseId, sceneId, status, nextDueAt, createdAt, *tags',
		})
		this.version(3).stores({
			words: '&id, italian, english, pos, category',
			userCards: '&[userId+wordId], userId, wordId, nextDueAt, archived',
			reviewLogs: '++id, userId, wordId, ts',
			exerciseStates:
				'&[userId+exerciseId], userId, exerciseId, nextDueAt, archived',
			exerciseLogs: '++id, userId, exerciseId, ts, outcome, correct',
			mistakes:
				'&id, userId, exerciseId, sceneId, status, nextDueAt, createdAt, *tags',
			misspellings: '&id, userId, word, correction, lastSeenAt',
		})
		this.version(4).stores({
			words: '&id, italian, english, pos, category',
			userCards: '&[userId+wordId], userId, wordId, nextDueAt, archived',
			reviewLogs: '++id, userId, wordId, ts',
			exerciseStates:
				'&[userId+exerciseId], userId, exerciseId, nextDueAt, archived',
			exerciseLogs: '++id, userId, exerciseId, ts, outcome, correct',
			mistakes:
				'&id, userId, exerciseId, sceneId, status, nextDueAt, createdAt, *tags',
			misspellings: '&id, userId, word, correction, lastSeenAt',
			dailySessions:
				'&id, userId, dateKey, status, startedAt, updatedAt, completedAt',
			dailySessionItems:
				'&id, sessionId, userId, dateKey, type, status, sortOrder',
		})
	}
}

export const db = new OlingoDB()

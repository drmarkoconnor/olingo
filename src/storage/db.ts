import Dexie, { Table } from 'dexie';

export type Word = {
  id: string;
  italian: string;
  english: string;
  pos?: 'noun' | 'verb' | 'adj' | 'collocation' | string;
  category?: string | null;
  createdAt: string;
};

export type UserCard = {
  userId: string; // local uid or supabase uid
  wordId: string;
  lastReviewedAt?: string | null;
  nextDueAt?: string | null;
  correctCount: number;
  wrongCount: number;
  ease: number; // ease factor (SM2-like)
  intervalDays: number; // last interval in days
  archived: 0 | 1; // 1 if mastered/archived
};

export type ReviewLog = {
  id?: number;
  userId: string;
  wordId: string;
  ts: string;
  correct: 0 | 1;
};

export class OlingoDB extends Dexie {
  words!: Table<Word, string>;
  userCards!: Table<UserCard, [string, string]>; // compound pk (userId+wordId)
  reviewLogs!: Table<ReviewLog, number>;

  constructor() {
    super('olingo');
    // & = primary key, [] = compound key / index
    this.version(1).stores({
      words: '&id, italian, english, pos, category',
      userCards: '&[userId+wordId], userId, wordId, nextDueAt, archived',
      reviewLogs: '++id, userId, wordId, ts',
    });
  }
}

export const db = new OlingoDB();

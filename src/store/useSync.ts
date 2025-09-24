import { create } from 'zustand';
import { db, type Word, type UserCard, type ReviewLog } from '@/storage/db';
import { supabase, hasSupabase } from '@/lib/supabase';
import { useAuth } from '@/store/useAuth';

type SyncState = {
  syncing: boolean;
  lastSyncAt?: string;
  error?: string | null;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  syncAll: () => Promise<void>;
};

export const useSync = create<SyncState>((set, get) => ({
  syncing: false,
  lastSyncAt: undefined,
  error: null,
  pull: async () => {
    if (!hasSupabase() || !supabase) return;
    set({ syncing: true, error: null });
    try {
      // Pull shared words
      const { data: words, error: werr } = await supabase.from('words').select('*');
      if (werr) throw werr;
      if (words) {
        const mapped: Word[] = words.map((w: any) => ({
          id: w.id,
          italian: w.italian,
          english: w.english,
          pos: w.pos || undefined,
          category: w.category || null,
          createdAt: w.created_at || new Date().toISOString(),
        }));
        await db.words.bulkPut(mapped);
      }

      // Pull current user's cards and merge
      const { userId } = useAuth.getState();
      const { data: cards, error: cerr } = await supabase.from('user_cards').select('*').eq('user_id', userId);
      if (cerr) throw cerr;
      if (cards) {
        const mapped: UserCard[] = cards.map((c: any) => ({
          userId: c.user_id,
          wordId: c.word_id,
          lastReviewedAt: c.last_reviewed_at,
          nextDueAt: c.next_due_at,
          correctCount: c.correct_count,
          wrongCount: c.wrong_count,
          ease: Number(c.ease ?? 2.3),
          intervalDays: c.interval_days ?? 0,
          archived: c.archived ? 1 : 0,
        }));
        await db.userCards.bulkPut(mapped);
      }
      set({ lastSyncAt: new Date().toISOString() });
    } catch (e: any) {
      set({ error: e.message || String(e) });
    } finally {
      set({ syncing: false });
    }
  },
  push: async () => {
    if (!hasSupabase() || !supabase) return;
    set({ syncing: true, error: null });
    try {
      const { userId } = useAuth.getState();
      // Push user_cards changes
      const cards = await db.userCards.where('userId').equals(userId).toArray();
      if (cards.length) {
        const payload = cards.map(c => ({
          user_id: c.userId,
          word_id: c.wordId,
          last_reviewed_at: c.lastReviewedAt,
          next_due_at: c.nextDueAt,
          correct_count: c.correctCount,
          wrong_count: c.wrongCount,
          ease: c.ease,
          interval_days: c.intervalDays,
          archived: !!c.archived,
        }));
        const { error } = await supabase.from('user_cards').upsert(payload, { onConflict: 'user_id,word_id' });
        if (error) throw error;
      }

      // Push review_logs append-only since last sync (simple approach: push all for now)
      const logs = await db.reviewLogs.where('userId').equals(userId).toArray();
      if (logs.length) {
        const payload = logs.map(l => ({ user_id: l.userId, word_id: l.wordId, ts: l.ts, correct: !!l.correct }));
        const { error } = await supabase.from('review_logs').insert(payload);
        if (error) throw error;
      }
      set({ lastSyncAt: new Date().toISOString() });
    } catch (e: any) {
      set({ error: e.message || String(e) });
    } finally {
      set({ syncing: false });
    }
  },
  syncAll: async () => {
    if (!hasSupabase() || !supabase) return;
    await get().push();
    await get().pull();
  }
}));

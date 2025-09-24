import { create } from 'zustand';
import { db, type Word, type UserCard } from '@/storage/db';
import { scheduleReview } from '@/srs/scheduler';

type QueueItem = { word: Word; state: UserCard };

type StudyState = {
  userId: string;
  dueQueue: QueueItem[];
  loadQueue: () => Promise<void>;
  markResult: (item: QueueItem, correct: boolean) => Promise<void>;
};

function isDue(iso?: string | null){
  if (!iso) return true;
  return new Date(iso).getTime() <= Date.now();
}

export const useStudyQueue = create<StudyState>((set, get) => ({
  userId: 'local-user',
  dueQueue: [],
  loadQueue: async () => {
    const { userId } = get();
    const cards = await db.userCards.where('userId').equals(userId).and(c => !c.archived && isDue(c.nextDueAt)).toArray();
    // join with words
    const words = await db.words.bulkGet(cards.map(c => c.wordId));
    const queue: QueueItem[] = [];
    for (let i=0;i<cards.length;i++){
      const w = words[i];
      if (w) queue.push({ word: w, state: cards[i] });
    }
    // limit session size to 20 for now
    set({ dueQueue: queue.slice(0, 20) });
  },
  markResult: async (item, correct) => {
    const outcome = correct ? 'correct' : 'wrong' as const;
    const updated = scheduleReview(item.state, outcome);
    await db.userCards.put(updated);
    await db.reviewLogs.add({ userId: updated.userId, wordId: updated.wordId, ts: new Date().toISOString(), correct: correct ? 1 : 0 });
    set(({ dueQueue }) => ({ dueQueue: dueQueue.filter(q => q.word.id !== item.word.id) }));
  },
}));

import { useEffect, useMemo, useState } from 'react';
import Flashcard from '@/ui/Flashcard';
import { useStudyQueue } from '@/store/useStudyQueue';
import { scheduleReview } from '@/srs/scheduler';
import { useDB } from '@/store/useDB';

export default function Study() {
  const { dueQueue, loadQueue, markResult } = useStudyQueue();
  const { ready } = useDB();
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (ready) {
      // Ensure per-word user card state exists, then load the due queue
      useDB.getState().ensureUserCardsForAllWords('local-user').then(loadQueue);
    }
  }, [ready, loadQueue]);

  const current = useMemo(() => dueQueue[0], [dueQueue]);

  function onShow() { setFlipped(true); }

  async function onMark(correct: boolean) {
    if (!current) return;
    await markResult(current, correct);
    setFlipped(false);
  }

  if (!current) return <p>All caught up! No cards due. Try adding more words or come back later.</p>;

  return (
    <div>
      <div className="top-stats">
        <span>Due: {dueQueue.length}</span>
      </div>
      <Flashcard
        card={current}
        flipped={flipped}
        onFlip={onShow}
      />
      <div className="controls">
        {!flipped ? (
          <button className="btn btn-muted" onClick={onShow}>Show answer</button>
        ) : (
          <>
            <button className="btn btn-danger" onClick={() => onMark(false)}>Wrong</button>
            <button className="btn btn-primary" onClick={() => onMark(true)}>Correct</button>
          </>
        )}
      </div>
    </div>
  );
}

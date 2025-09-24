import { useEffect, useState } from 'react';
import { db } from '@/storage/db';

export default function Stats(){
  const [counts, setCounts] = useState({ total: 0, archived: 0 });
  useEffect(() => { (async () => {
    const total = await db.words.count();
    const archived = await db.userCards.where('archived').equals(1).count();
    setCounts({ total, archived });
  })(); }, []);

  return (
    <div>
      <h2>Stats</h2>
      <div className="grid">
        <div className="tile"><strong>Total words</strong><div>{counts.total}</div></div>
        <div className="tile"><strong>Mastered</strong><div>{counts.archived}</div></div>
      </div>
      <div className="tile" style={{marginTop:12}}>
        <strong>Streak</strong>
        <div>Coming soon</div>
      </div>
    </div>
  );
}

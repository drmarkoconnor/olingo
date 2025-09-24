import { useState } from 'react';

export default function Settings(){
  const [dailyGoal, setDailyGoal] = useState(20);
  const [sound, setSound] = useState(true);
  return (
    <div>
      <h2>Settings</h2>
      <div className="tile">
        <label>Daily goal (cards)</label>
        <input type="number" value={dailyGoal} onChange={e=>setDailyGoal(parseInt(e.target.value||'0'))} />
      </div>
      <div className="tile">
        <label><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)} /> Sound effects</label>
      </div>
    </div>
  );
}

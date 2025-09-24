import Papa from 'papaparse';
import { db } from '@/storage/db';

type Row = {
  italian: string;
  english: string;
  pos?: string;
  category?: string;
};

export default function ImportData(){
  async function onFile(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data.filter(r => r.italian && r.english);
    await db.words.bulkPut(rows.map((r, idx) => ({
      id: crypto.randomUUID(),
      italian: r.italian.trim(),
      english: r.english.trim(),
      pos: (r.pos||'').toLowerCase(),
      category: r.category?.trim() || null,
      createdAt: new Date().toISOString(),
    })));
    alert(`Imported ${rows.length} rows`);
  }
  return (
    <div>
      <h2>Import CSV</h2>
      <p>Upload a CSV with headers: italian, english, pos, category</p>
      <input type="file" accept="text/csv" onChange={onFile} />
    </div>
  );
}

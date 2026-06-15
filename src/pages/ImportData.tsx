import Papa from 'papaparse'
import { db } from '@/storage/db'
import { useAuth } from '@/store/useAuth'
import { useDB } from '@/store/useDB'

type Row = {
	italian: string
	english: string
	pos?: string
	category?: string
}

export default function ImportData() {
	const { userId } = useAuth()
	async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0]
		if (!f) return
		const text = await f.text()
		const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true })
		const rows = parsed.data.filter((r) => r.italian && r.english)
		const localWords = rows.map((r) => ({
			id: crypto.randomUUID(),
			italian: r.italian.trim(),
			english: r.english.trim(),
			pos: (r.pos || '').toLowerCase(),
			category: r.category?.trim() || null,
			createdAt: new Date().toISOString(),
		}))
		await db.words.bulkPut(localWords)
		// seed user cards for these words
		await useDB.getState().ensureUserCardsForAllWords(userId)
		alert(`Imported ${rows.length} rows`)
	}
	return (
		<div>
			<h2>Import CSV</h2>
			<p>Upload a CSV with headers: italian, english, pos, category</p>
			<input type="file" accept="text/csv" onChange={onFile} />
		</div>
	)
}

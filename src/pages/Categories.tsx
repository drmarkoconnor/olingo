import { useEffect, useState } from 'react'
import { db } from '@/storage/db'

export default function Categories() {
	const [cats, setCats] = useState<{ name: string; count: number }[]>([])
	useEffect(() => {
		;(async () => {
			const words = await db.words.toArray()
			const map = new Map<string, number>()
			for (const w of words) {
				const k = w.category || 'Uncategorized'
				map.set(k, (map.get(k) || 0) + 1)
			}
			setCats(Array.from(map, ([name, count]) => ({ name, count })))
		})()
	}, [])

	return (
		<div>
			<h2>Categories</h2>
			<div className="grid">
				{cats.map((c) => (
					<div className="tile" key={c.name}>
						<div className="row" style={{ justifyContent: 'space-between' }}>
							<strong>{c.name}</strong>
							<span className="pos-pill">{c.count}</span>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}


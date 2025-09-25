export function nowISO() {
	return new Date().toISOString()
}
export function addDays(date: Date, days: number) {
	const d = new Date(date)
	d.setDate(d.getDate() + days)
	return d
}


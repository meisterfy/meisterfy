export function wowDelta(
	cur: number,
	prev: number,
	lowerIsBetter = false
): { pct: string; dir: 'up' | 'down' | 'flat' } {
	if (prev === 0) return { pct: '—', dir: 'flat' }
	const d = ((cur - prev) / prev) * 100
	if (Math.abs(d) < 1) return { pct: '~0%', dir: 'flat' }
	const pct = (d > 0 ? '+' : '') + d.toFixed(0) + '%'
	const positive = lowerIsBetter ? d < 0 : d > 0
	return { pct, dir: positive ? 'up' : 'down' }
}

export function formatTimestamp(ts: string): string {
	return new Date(ts).toLocaleString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})
}

export function formatDateStr(dateStr: string): string {
	return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	})
}

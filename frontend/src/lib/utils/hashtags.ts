export function parseHashtags(input: string): string[] {
	return input
		.split(/\s+/)
		.map((t) => t.replace(/^#/, ''))
		.filter(Boolean)
}

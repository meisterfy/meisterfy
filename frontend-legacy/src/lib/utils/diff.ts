export function getDiffs(
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	prefix = ''
): { key: string; oldVal: unknown; newVal: unknown }[] {
	let diffs: { key: string; oldVal: unknown; newVal: unknown }[] = []
	if (!before) before = {}
	if (!after) after = {}

	const isObject = (val: unknown): val is Record<string, unknown> =>
		val !== null && typeof val === 'object' && !Array.isArray(val)

	const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
	for (const key of allKeys) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		const valBefore = before[key]
		const valAfter = after[key]

		if (isObject(valBefore) && isObject(valAfter)) {
			diffs = diffs.concat(getDiffs(valBefore, valAfter, fullKey))
		} else if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
			diffs.push({
				key: fullKey,
				oldVal: valBefore,
				newVal: valAfter
			})
		}
	}
	return diffs
}

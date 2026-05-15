export function getDiffs(before: any, after: any, prefix = ''): { key: string; oldVal: any; newVal: any }[] {
	let diffs: { key: string; oldVal: any; newVal: any }[] = []
	if (!before) before = {}
	if (!after) after = {}

	const isObject = (val: any) => val !== null && typeof val === 'object' && !Array.isArray(val)

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

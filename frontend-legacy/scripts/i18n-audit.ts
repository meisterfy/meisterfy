/**
 * Hardcoded UI string audit for Paraglide/inlang.
 * Usage: bun run scripts/i18n-audit.ts [--check] [--json]
 */
import { parse } from 'svelte/compiler'
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = path.resolve(__dirname, '..')
const SRC_ROOT = path.join(FRONTEND_ROOT, 'src')
const LOCALES_EN = path.join(FRONTEND_ROOT, 'locales', 'en')
const REPORT_DIR = path.resolve(FRONTEND_ROOT, '..', '.project', 'reports', 'i18n-audit')
const BASELINE_PATH = path.join(REPORT_DIR, 'i18n-audit-baseline.json')

const PARAGLIDE_IMPORT = /paraglide\/messages/

const EXCLUDE_PATH_RE = /(paraglide\/|__test-mocks__|vitest-examples|\.test\.|\.spec\.)/

const BRAND_LITERALS = new Set(['Meisterfy', 'MMeisterfy', 'logo.svg'])

const UI_ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt'])

const TS_UI_RE =
	/(?:placeholder|title|aria-label|label|header|description|message|emptyText|confirmText|cancelText)\s*[:=]\s*['"`]([^'"`]{2,})['"`]/g

type Priority = 'quick_win' | 'must' | 'should' | 'maybe' | 'skip'

type Candidate = {
	file: string
	line: number
	text: string
	kind: 'template' | 'attr' | 'ts'
	priority: Priority
	existingKey?: string
	suggestedNamespace?: string
	hasParaglideImport: boolean
}

type LocaleEntry = { namespace: string; key: string; value: string; fullKey: string }

const args = process.argv.slice(2)
const checkMode = args.includes('--check')
const jsonOnly = args.includes('--json')

function relative(p: string) {
	return path.relative(FRONTEND_ROOT, p).replaceAll('\\', '/')
}

function shouldSkipPath(filePath: string) {
	return EXCLUDE_PATH_RE.test(filePath)
}

function normalizeText(s: string) {
	return s.replace(/\s+/g, ' ').trim()
}

function looksLikeTailwindOrCss(t: string): boolean {
	if (
		/\b(flex|grid|rounded|border|bg-|text-slate|text-white|dark:|hover:|group|max-w-|mx-auto|px-|py-|mt-|mb-|gap-|items-|justify-|overflow-|transition-|object-contain|shadow|uppercase|tracking-|font-|sm:|lg:|xl:|via-|from-|to-|opacity-|blur-|fixed|absolute|relative|z-|min-h-|w-full|h-full)\b/.test(
			t
		)
	)
		return true
	if (/^(h-|w-|p-|m-|gap-)[\w-]+$/.test(t)) return true
	if (/^[\w./%-]+$/.test(t) && t.includes('/')) return true
	if ((t.match(/-/g)?.length ?? 0) >= 2 && t.length > 20 && !/[.!?]/.test(t)) return true
	return false
}

function looksLikeUiCopy(t: string): boolean {
	if (/[.!?']/.test(t)) return true
	if (
		/\b(the|and|your|client|manage|welcome|settings|create|found|select|back|account|started|connectors)\b/i.test(
			t
		)
	)
		return true
	if (/^[A-Z][a-z]+(\s+[A-Za-z]+)+/.test(t)) return true
	return t.length >= 10 && /\s/.test(t) && !looksLikeTailwindOrCss(t)
}

function isSkippableText(text: string): boolean {
	const t = normalizeText(text)
	if (t.length < 2) return true
	if (BRAND_LITERALS.has(t)) return true
	if (/^https?:\/\//.test(t)) return true
	if (/^\/[\w/.-]+$/.test(t)) return true
	if (/^[\d\s.,:%$+-]+$/.test(t)) return true
	if (!/[a-zA-ZÀ-ÿ]/.test(t)) return true
	if (/^[a-z0-9_-]+$/.test(t) && t.includes('_')) return true
	// Regex metacharacters without spaces (e.g., [a-z0-9-]+)
	if (/[[\](){}+*?^$|\\]/.test(t) && !/\s/.test(t)) return true
	// SVG path data (M9.937 15.5A2...) or SVG attribute values (currentColor)
	if (/^[MmLlHhVvCcSsQqTtAaZz][\d\s.,+-]/.test(t)) return true
	if (/^(currentColor|inherit|initial|unset|currentcolor)$/i.test(t)) return true
	// CSS/style fragments that start with non-letter chars (%; background:)
	if (/^[%;]/.test(t)) return true
	// Multi-token CSS class string: every space-separated token is [a-z][a-z0-9.-]*-[a-z0-9.]+
	// Catches: "h-3 w-3 text-red-400", "pb-2 text-left", "text-emerald-500", "campaign-objective"
	if (/^([a-z][a-z0-9.-]*-[a-z0-9.]+(\s+|$))+$/.test(t)) return true
	if (looksLikeTailwindOrCss(t)) return true
	if (t.length < 10 && !looksLikeUiCopy(t) && /^[a-z0-9\s:.-]+$/i.test(t)) return true
	return false
}

function suggestNamespace(file: string): string {
	if (file.includes('/routes/login')) return 'auth'
	if (file.includes('/settings/')) return 'settings'
	if (file.includes('/ads/')) return 'ads'
	if (file.includes('/social')) return 'social-media'
	if (file.includes('/tenants')) return 'tenants'
	if (file.includes('/integrations')) return 'integrations'
	if (file.includes('/roles') || file.includes('/permissions')) return 'permissions'
	return 'globals'
}

function classifyPriority(file: string, kind: Candidate['kind'], existingKey?: string): Priority {
	if (existingKey) return 'quick_win'
	if (file.includes('seo.svelte')) return 'maybe'
	if (kind === 'attr') return 'should'
	return 'must'
}

async function walkDir(dir: string, ext: string | string[]): Promise<string[]> {
	const exts = Array.isArray(ext) ? ext : [ext]
	const out: string[] = []
	const entries = await readdir(dir, { withFileTypes: true })
	for (const e of entries) {
		const full = path.join(dir, e.name)
		if (e.isDirectory()) {
			if (e.name === 'node_modules') continue
			out.push(...(await walkDir(full, exts)))
		} else if (exts.some((x) => e.name.endsWith(x))) {
			out.push(full)
		}
	}
	return out
}

async function loadLocales(dir: string): Promise<LocaleEntry[]> {
	const entries: LocaleEntry[] = []
	const files = await readdir(dir)
	for (const f of files.filter((x) => x.endsWith('.json'))) {
		const namespace = f.replace(/\.json$/, '')
		const raw = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as Record<string, string>
		for (const [key, value] of Object.entries(raw)) {
			if (typeof value !== 'string') continue
			entries.push({
				namespace,
				key,
				value,
				fullKey: `${namespace}:${key}`
			})
		}
	}
	return entries
}

function buildValueIndex(enLocales: LocaleEntry[]) {
	const byValue = new Map<string, string[]>()
	for (const e of enLocales) {
		const norm = normalizeText(e.value)
		if (!norm) continue
		const list = byValue.get(norm) ?? []
		list.push(e.fullKey)
		byValue.set(norm, list)
	}
	return byValue
}

function findExistingKey(text: string, byValue: Map<string, string[]>): string | undefined {
	const norm = normalizeText(text)
	const keys = byValue.get(norm)
	if (!keys?.length) return undefined
	return keys.length === 1 ? keys[0] : keys.join(' | ')
}

async function fileHasParaglideImport(filePath: string): Promise<boolean> {
	const content = await readFile(filePath, 'utf8')
	return PARAGLIDE_IMPORT.test(content)
}

function lineHasIgnore(lines: string[], lineIndex: number): boolean {
	const prev = lines[lineIndex - 2] ?? ''
	const curr = lines[lineIndex - 1] ?? ''
	return /i18n-ignore|i18n-audit:ignore/.test(prev + curr)
}

function fileHasIgnoreFile(content: string): boolean {
	const head = content.split('\n').slice(0, 5).join('\n')
	return /i18n-audit:ignore-file/.test(head)
}

type AstNode = {
	type?: string
	data?: string
	raw?: string
	name?: string
	value?: unknown
	children?: AstNode[]
	start?: number
	end?: number
}

function offsetToLine(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length
}

function pushCandidate(
	out: Candidate[],
	seen: Set<string>,
	source: string,
	lines: string[],
	file: string,
	hasImport: boolean,
	text: string,
	kind: Candidate['kind'],
	start?: number
) {
	const norm = normalizeText(text)
	if (isSkippableText(norm)) return
	const line = start != null ? offsetToLine(source, start) : 1
	if (lineHasIgnore(lines, line)) return
	const dedupe = `${file}:${line}:${norm}`
	if (seen.has(dedupe)) return
	seen.add(dedupe)
	out.push({
		file,
		line,
		text: norm,
		kind,
		priority: kind === 'attr' ? 'should' : 'must',
		hasParaglideImport: hasImport,
		suggestedNamespace: suggestNamespace(file)
	})
}

/** Walk entire Svelte 5 AST (IfBlock.consequent, SnippetBlock.body, etc.). */
function walkAstTree(
	root: unknown,
	source: string,
	lines: string[],
	out: Candidate[],
	file: string,
	hasImport: boolean,
	seen: Set<string>,
	visited = new Set<unknown>()
) {
	if (!root || typeof root !== 'object' || visited.has(root)) return
	visited.add(root)
	const node = root as AstNode

	if (node.type === 'Text') {
		const raw = typeof node.data === 'string' ? node.data : node.raw
		if (typeof raw === 'string') {
			pushCandidate(out, seen, source, lines, file, hasImport, raw, 'template', node.start)
		}
	}

	if (node.type === 'Attribute' && typeof node.name === 'string' && UI_ATTRS.has(node.name)) {
		const value = node.value as AstNode[] | undefined
		if (Array.isArray(value) && !value.some((v) => v.type === 'Expression')) {
			const text = value
				.filter((v) => v.type === 'Text')
				.map((v) => (typeof v.data === 'string' ? v.data : v.raw) ?? '')
				.join('')
			pushCandidate(out, seen, source, lines, file, hasImport, text, 'attr', node.start)
		}
	}

	for (const v of Object.values(root)) {
		if (Array.isArray(v)) {
			for (const item of v) walkAstTree(item, source, lines, out, file, hasImport, seen, visited)
		} else if (v && typeof v === 'object') {
			walkAstTree(v, source, lines, out, file, hasImport, seen, visited)
		}
	}
}

/** Regex fallback for static UX attributes not always in AST. */
function extractAttrRegex(
	source: string,
	lines: string[],
	file: string,
	hasImport: boolean,
	seen: Set<string>,
	out: Candidate[]
) {
	const attrRe = /\b(placeholder|title|aria-label|alt)\s*=\s*["']([^"']+)["']/g
	let match: RegExpExecArray | null
	while ((match = attrRe.exec(source)) !== null) {
		if (/\{/.test(match[2])) continue
		pushCandidate(out, seen, source, lines, file, hasImport, match[2], 'attr', match.index)
	}
}

async function extractFromSvelte(filePath: string, hasImport: boolean): Promise<Candidate[]> {
	const source = await readFile(filePath, 'utf8')
	if (fileHasIgnoreFile(source)) return []

	const file = relative(filePath)
	const lines = source.split('\n')
	const out: Candidate[] = []

	const seen = new Set<string>()

	try {
		const ast = parse(source, { modern: true }) as {
			fragment?: AstNode
			html?: AstNode
		}
		const root = ast.fragment ?? ast.html
		if (root) walkAstTree(root, source, lines, out, file, hasImport, seen)
	} catch (err) {
		console.warn(`[i18n-audit] parse failed: ${file}`, err)
	}

	extractAttrRegex(source, lines, file, hasImport, seen, out)

	return out
}

async function extractFromTsAsync(filePath: string, hasImport: boolean): Promise<Candidate[]> {
	const source = await readFile(filePath, 'utf8')
	if (fileHasIgnoreFile(source)) return []

	const file = relative(filePath)
	const lines = source.split('\n')
	const out: Candidate[] = []

	let match: RegExpExecArray | null
	const re = new RegExp(TS_UI_RE.source, 'g')
	while ((match = re.exec(source)) !== null) {
		const text = normalizeText(match[1])
		if (isSkippableText(text)) continue
		const line = source.slice(0, match.index).split('\n').length
		if (lineHasIgnore(lines, line)) continue
		out.push({
			file,
			line,
			text,
			kind: 'ts',
			priority: 'must',
			hasParaglideImport: hasImport,
			suggestedNamespace: suggestNamespace(file)
		})
	}

	return out
}

function enrichCandidates(candidates: Candidate[], byValue: Map<string, string[]>) {
	for (const c of candidates) {
		const existing = findExistingKey(c.text, byValue)
		if (existing) {
			c.existingKey = existing
			c.priority = 'quick_win'
		} else {
			c.priority = classifyPriority(c.file, c.kind, undefined)
		}
		if (isSkippableText(c.text)) c.priority = 'skip'
	}
	return candidates.filter((c) => c.priority !== 'skip')
}

function toMarkdownReport(data: {
	generatedAt: string
	filesWithoutParaglide: string[]
	candidates: Candidate[]
	stats: Record<string, number>
}) {
	const quickWins = data.candidates.filter((c) => c.priority === 'quick_win')
	const routesMust = data.candidates.filter(
		(c) => c.priority === 'must' && c.file.startsWith('src/routes/') && !c.hasParaglideImport
	)

	let md = `# i18n hardcoded string audit\n\n`
	md += `Generated: ${data.generatedAt}\n\n`
	md += `## Summary\n\n`
	md += `| Metric | Count |\n|--------|-------|\n`
	for (const [k, v] of Object.entries(data.stats)) {
		md += `| ${k} | ${v} |\n`
	}
	md += `\n`

	md += `## Quick wins (existing locale key, hardcoded in UI)\n\n`
	if (!quickWins.length) md += `_None_\n\n`
	else {
		md += `| File | Line | Text | Use key |\n|------|------|------|--------|\n`
		for (const c of quickWins.slice(0, 80)) {
			md += `| ${c.file} | ${c.line} | ${c.text.slice(0, 40)} | \`${c.existingKey}\` |\n`
		}
		if (quickWins.length > 80) md += `\n_…and ${quickWins.length - 80} more (see JSON report)_\n`
		md += `\n`
	}

	md += `## Routes without Paraglide import (${data.filesWithoutParaglide.length} svelte files)\n\n`
	md += `<details><summary>File list</summary>\n\n`
	for (const f of data.filesWithoutParaglide) md += `- ${f}\n`
	md += `\n</details>\n\n`

	md += `## Must-priority in routes (no paraglide import) — top 50\n\n`
	if (!routesMust.length) md += `_None_\n\n`
	else {
		md += `| File | Line | Text |\n|------|------|------|\n`
		for (const c of routesMust.slice(0, 50)) {
			md += `| ${c.file} | ${c.line} | ${c.text.slice(0, 50)} |\n`
		}
		if (routesMust.length > 50) md += `\n_…and ${routesMust.length - 50} more_\n`
	}

	const byFeature = new Map<string, number>()
	for (const c of data.candidates.filter((x) => x.priority === 'must')) {
		let area = 'lib/components'
		if (c.file.startsWith('src/routes/')) {
			const parts = c.file.replace('src/routes/', '').split('/')
			area = parts[0] === '[tenant]' ? `tenant/${parts[1] ?? 'root'}` : parts[0]
		}
		byFeature.set(area, (byFeature.get(area) ?? 0) + 1)
	}
	md += `\n## Triage backlog (must) by area\n\n`
	md += `| Area | Count |\n|------|-------|\n`
	for (const [area, count] of [...byFeature.entries()].sort((a, b) => b[1] - a[1])) {
		md += `| ${area} | ${count} |\n`
	}

	md += `\n## CI baseline\n\n`
	md += `Routes \`quick_win\` must not exceed baseline (see \`i18n-audit-baseline.json\`).\n`

	return md
}

async function main() {
	const enLocales = await loadLocales(LOCALES_EN)
	const byValue = buildValueIndex(enLocales)

	const svelteFiles = (await walkDir(SRC_ROOT, '.svelte')).filter((f) => !shouldSkipPath(f))
	const tsFiles = (await walkDir(SRC_ROOT, ['.ts', '.svelte.ts'])).filter(
		(f) => !shouldSkipPath(f) && !f.endsWith('.d.ts')
	)

	const filesWithoutParaglide: string[] = []
	const allCandidates: Candidate[] = []

	for (const filePath of svelteFiles) {
		const hasImport = await fileHasParaglideImport(filePath)
		const rel = relative(filePath)
		if (!hasImport) filesWithoutParaglide.push(rel)
		const found = await extractFromSvelte(filePath, hasImport)
		allCandidates.push(...found)
	}

	for (const filePath of tsFiles) {
		const hasImport = await fileHasParaglideImport(filePath)
		const found = await extractFromTsAsync(filePath, hasImport)
		allCandidates.push(...found)
	}

	const candidates = enrichCandidates(allCandidates, byValue)

	const stats = {
		svelte_files_scanned: svelteFiles.length,
		ts_files_scanned: tsFiles.length,
		files_without_paraglide_import: filesWithoutParaglide.length,
		candidates_total: candidates.length,
		quick_win: candidates.filter((c) => c.priority === 'quick_win').length,
		must: candidates.filter((c) => c.priority === 'must').length,
		should: candidates.filter((c) => c.priority === 'should').length,
		maybe: candidates.filter((c) => c.priority === 'maybe').length
	}

	const generatedAt = new Date().toISOString()
	const report = {
		generatedAt,
		filesWithoutParaglide: filesWithoutParaglide.sort(),
		candidates: candidates.sort((a, b) => {
			const order = { quick_win: 0, must: 1, should: 2, maybe: 3, skip: 4 }
			return order[a.priority] - order[b.priority] || a.file.localeCompare(b.file)
		}),
		stats
	}

	if (jsonOnly) {
		console.log(JSON.stringify(report, null, 2))
	} else {
		await mkdir(REPORT_DIR, { recursive: true })
		const jsonPath = path.join(REPORT_DIR, 'i18n-audit.json')
		const mdPath = path.join(REPORT_DIR, 'i18n-audit.md')
		const inventoryPath = path.join(REPORT_DIR, 'i18n-audit-inventory.md')
		await writeFile(jsonPath, JSON.stringify(report, null, 2))
		await writeFile(mdPath, toMarkdownReport(report))
		await writeFile(
			inventoryPath,
			[
				'# i18n audit — files without Paraglide import',
				'',
				`Generated: ${generatedAt}`,
				'',
				`Total: **${filesWithoutParaglide.length}** of ${svelteFiles.length} scanned \`.svelte\` files`,
				'',
				...filesWithoutParaglide.map((f) => `- \`${f}\``)
			].join('\n')
		)
		console.log(`[i18n-audit] Wrote ${relative(jsonPath)}`)
		console.log(`[i18n-audit] Wrote ${relative(mdPath)}`)
		console.log(`[i18n-audit] Wrote ${relative(inventoryPath)}`)
		console.log('[i18n-audit] Stats:', stats)
	}

	if (checkMode) {
		let failed = false

		const routesQuickWin = candidates.filter(
			(c) => c.priority === 'quick_win' && c.file.startsWith('src/routes/')
		)
		let baseline: { routes_quick_win_max: number; updated_at?: string } = {
			routes_quick_win_max: routesQuickWin.length
		}
		try {
			baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'))
		} catch {
			await writeFile(BASELINE_PATH, JSON.stringify(baseline, null, 2))
			console.log(
				`[i18n-audit] Created baseline ${relative(BASELINE_PATH)} (routes_quick_win_max=${routesQuickWin.length})`
			)
		}

		if (routesQuickWin.length > baseline.routes_quick_win_max) {
			console.error(
				`[i18n-audit] FAIL: routes quick_win ${routesQuickWin.length} exceeds baseline ${baseline.routes_quick_win_max}`
			)
			for (const c of routesQuickWin.slice(0, 15)) {
				console.error(`  ${c.file}:${c.line} "${c.text}" -> ${c.existingKey}`)
			}
			failed = true
		} else if (routesQuickWin.length < baseline.routes_quick_win_max) {
			console.log(
				`[i18n-audit] routes quick_win improved (${routesQuickWin.length} < baseline ${baseline.routes_quick_win_max}); update baseline to lock in progress`
			)
		}

		if (failed) process.exit(1)
		console.log('[i18n-audit] --check passed')
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})

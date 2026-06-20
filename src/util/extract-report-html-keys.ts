/**
 * Extract XBRL concept/member QNames from SEC R*.htm report tables.
 *
 * Keys appear in cell onclick handlers as `defref_{prefix}_{LocalName}` or
 * `defref_{Axis}={Member}`. We only need presence on the rendered table for
 * pruning linkbase trees — not cell grid structure or fact values.
 */

function unwrapDocument(html: string): string {
	const textStart = html.indexOf('<TEXT>')
	const textEnd = html.indexOf('</TEXT>')
	if (textStart !== -1 && textEnd !== -1) return html.slice(textStart + 6, textEnd)
	return html
}

function extractReportTableHtml(html: string): string {
	const unwrapped = unwrapDocument(html)
	const start = unwrapped.indexOf('<table class="report"')
	if (start === -1) return unwrapped
	const end = unwrapped.indexOf('</table>', start)
	if (end === -1) return unwrapped.slice(start)
	return unwrapped.slice(start, end + '</table>'.length)
}

function formatQNamePart(part: string): string {
	const i = part.indexOf('_')
	return i === -1 ? part : `${part.slice(0, i)}:${part.slice(i + 1)}`
}

/** Parse `defref_us-gaap_Foo` or `defref_dei_LegalEntityAxis=so_AlabamaPowerMember`. */
function parseDefrefToken(raw: string): string | null {
	const defref = raw.startsWith('defref_') ? raw.slice('defref_'.length) : raw
	if (!defref.includes('_')) return null
	if (defref.includes('=')) {
		const memberPart = defref.split('=').pop()
		return memberPart ? formatQNamePart(memberPart) : null
	}
	return formatQNamePart(defref)
}

const DEFREF_IN_HTML_RE = /defref_([a-zA-Z0-9][\w-]*(?:=[a-zA-Z0-9][\w-]*)?)/g

/**
 * All concept/member keys referenced on the report's R-file HTML table.
 * Falls back to scanning the full document when no `<table class="report">` exists.
 */
export function extractKeysFromReportHtml(html: string): Set<string> {
	const keys = new Set<string>()
	const scope = extractReportTableHtml(html)
	for (const match of scope.matchAll(DEFREF_IN_HTML_RE)) {
		const key = parseDefrefToken(`defref_${match[1]}`)
		if (key) keys.add(key)
	}
	return keys
}

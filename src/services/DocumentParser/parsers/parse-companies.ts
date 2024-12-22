import type { CompanySearchResult, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

export function parseCompanies(params: XMLParams) {
	const { xml } = params

	const parser = new XMLParser({ textSelectStrategy: 'concatenate', textConcatDivider: '<>' })
	const result = parser.parse(xml)

	const body = result.html?.body ?? {}
	const bodyDivs = Array.isArray(body.div) ? body.div : [body.div].filter(Boolean)

	const contentDiv =
		bodyDivs.find((d: Record<string, unknown>) => d && typeof d === 'object' && d['@_id'] === 'contentDiv') ??
		({} as Record<string, unknown>[])

	const tableDivs = Array.isArray(contentDiv.div) ? contentDiv.div : [contentDiv.div].filter(Boolean)
	const tableDiv =
		tableDivs.find((d: Record<string, unknown>) => d && typeof d === 'object' && d['@_id'] === 'seriesDiv') ??
		({} as Record<string, unknown>[])

	let rows = tableDiv.table?.tr ?? tableDiv.table?.tbody?.tr ?? []
	rows = (Array.isArray(rows) ? rows : [rows])
		.filter((r) => r?.td)
		.map((r) => (Array.isArray(r.td) ? r.td : [r.td]).filter(Boolean))

	const items: CompanySearchResult[] = []
	for (const row of rows) {
		const cik = Number(row[0]?.a?.['#text']) || 0
		if (!cik) continue
		const row1Parts = (row[1]?.['#text'] || '').split('<>') ?? []
		const sic = Number(row[1]?.a?.['#text']) || null
		const companyName = row1Parts[0].trim()
		const sicDescription = sic ? row1Parts.pop()?.replace('-', '').trim() || null : null
		const stateOrCountry = row[2]?.a?.['#text'] || null

		items.push({ cik, sic, sicDescription, companyName, stateOrCountry })
	}

	return { items }
}

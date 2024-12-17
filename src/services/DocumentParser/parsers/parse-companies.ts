import { XMLParams } from '../../../types'
import { CompanySearchResult } from '../../../types/company-search.type'
import HtmlTableExtractor from '../../HtmlTableExtractor'

export function parseCompanies(params: XMLParams) {
	const { xml } = params

	const parser = new HtmlTableExtractor()
	const tables = parser.extractTables(xml, {
		stripHtml: true,
		tagsToExclude: ['sup'],
		stripParenthesis: true,
		removeEmptyColumns: false,
		getHeaderRowIndex: (data) => {
			return data.rows.findIndex((row) => {
				const isNotEmptyRow = row.some(
					(cell) => cell.html.replace(/<.*?>/g, '').replace(/&.*?;/g, '').replace(/\s/g, '').length > 0,
				)
				return isNotEmptyRow
			})
		},
	})

	const header = ['cik', 'company_name', 'state_country']
	const table = tables.find((t) => t.rows.some((r) => r.some((c) => c.html.includes('CIK'))))

	const items: CompanySearchResult[] = []
	for (const row of table?.rows ?? []) {
		if (row[0]?.isHeaderRowCell) continue

		const item = {
			cik: 0,
			companyName: '',
			stateOrCountry: '',
		}

		for (const cell of row) {
			const colName = header[cell.colIndex]
			switch (colName) {
				case 'cik':
					item.cik = Number(cell.valueParsed) || 0
					break
				case 'company_name':
					item.companyName = String(
						cell.html.split('>')[1]?.split('<')[0]?.split('/')[0] || cell.valueParsed,
					).trim()
					break
				case 'state_country':
					item.stateOrCountry = String(cell.valueParsed || '')
					break
			}
		}

		items.push(item)
	}

	return { items }
}

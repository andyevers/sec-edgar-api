import { TableData, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

interface ExecutiveCompensation {
	name: string
	position: string | null
	year: number | null
	salaryDollars: number | null
	bonusDollars: number | null
	stockAwardDollars: number | null
	nonEquityDollars: number | null
	otherDollars: number | null
	totalDollars: number | null
}

export function parseFormDef14a(params: XMLParams, xmlParser = new XMLParser()): ExecutiveCompensation[] {
	const { xml } = params
	const doc = xmlParser.getDocumentNode({ xml })

	const tables = doc.parseTables()
	const usedTables: TableData[] = []
	const compensationArr: ExecutiveCompensation[] = []

	const findCompensationTable = (type: string) => {
		const table =
			tables.find(
				(table) =>
					table.title.toLowerCase().includes(type) &&
					table.title.toLowerCase().includes('compensation') &&
					!usedTables.includes(table),
			) ||
			tables.find((table) => {
				const hasNameRow = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('name'))
				const hasTotalRow = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('total'))
				const hasAwardRow = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('award'))
				return (
					hasNameRow &&
					hasTotalRow &&
					hasAwardRow &&
					table.textBefore?.toLowerCase().includes(type) &&
					!usedTables.includes(table)
				)
			})

		if (table) usedTables.push(table)

		return table
	}

	for (const type of ['director', 'executive', 'summary']) {
		const table = findCompensationTable(type)
		if (!table) continue

		const header = table.rows[0]
		const getIndex = (search: string) => header.findIndex((col) => `${col}`.toLowerCase().includes(search))

		const indexName = getIndex('name')
		const indexYear = getIndex('year')
		const indexSalary = getIndex('salary') === -1 ? getIndex('cash') : getIndex('salary')
		const indexBonus = getIndex('bonus')
		const indexStock = getIndex('stock')
		const indexNonEquity = getIndex('non-equity')
		const indexOther = getIndex('other')
		const indexTotal = getIndex('total')

		const defaultPosition = {
			director: 'Director',
			executive: 'Executive',
			summary: null,
		}[type]

		for (let i = 1; i < table.rows.length; i++) {
			const nameVal = table.rows[i]?.[indexName] ?? null
			if (typeof nameVal !== 'string') continue

			const nameParts = nameVal.split('}}')
			const namePartsSpaces = nameVal.split(' ')

			const position = nameParts[1] ?? namePartsSpaces.slice(2, namePartsSpaces.length).join(' ')
			const name = nameParts[1] ? nameParts[0] : namePartsSpaces.slice(0, 2).join(' ')

			const compensation: ExecutiveCompensation = {
				name: name.replace(/{{/g, '').replace(/}}/g, '').trim(),
				position: position.replace(/{{/g, '').replace(/}}/g, '').trim() || (defaultPosition ?? null),
				year: Number(table.rows[i]?.[indexYear]) || null,
				salaryDollars: Number(table.rows[i]?.[indexSalary]) || null,
				bonusDollars: Number(table.rows[i]?.[indexBonus]) || null,
				stockAwardDollars: Number(table.rows[i]?.[indexStock]) || null,
				nonEquityDollars: Number(table.rows[i]?.[indexNonEquity]) || null,
				otherDollars: Number(table.rows[i]?.[indexOther]) || null,
				totalDollars: Number(table.rows[i]?.[indexTotal]) || null,
			}
			compensationArr.push(compensation)
		}
	}

	return compensationArr
}

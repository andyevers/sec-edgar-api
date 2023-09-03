import { ExecutiveCompensation, FormDef14aData, Holder, TableData, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

/**
 * Form DEF 14a - Proxy Statement
 *
 * example at https://www.sec.gov/Archives/edgar/data/320193/000130817923000019/laap2023_def14a.htm
 */
export function parseFormDef14a(params: XMLParams, xmlParser = new XMLParser()): FormDef14aData {
	const { xml } = params
	const doc = xmlParser.getDocumentNode({ xml })

	const tables = doc.parseTables()
	const usedTables: TableData[] = []
	const compensationArr: ExecutiveCompensation[] = []
	const holderArr: Holder[] = []

	const findCompensationTables = (type: string) => {
		const tablesFound = tables.filter((table) => {
			const hasNameRow = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('name'))
			const hasTotalRow = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('total'))
			const hasAwardRow = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('award'))

			const titleLower = table.title.toLowerCase()
			const textLower = table.textBefore?.toLowerCase() ?? ''
			const isTitleMatch = titleLower.includes(type) && titleLower.includes('compensation')
			const isTextMatch = hasNameRow && hasTotalRow && hasAwardRow && textLower.includes(type)

			return (isTitleMatch || isTextMatch) && !usedTables.includes(table)
		})

		tablesFound.forEach((t) => usedTables.push(t))

		return tablesFound
	}

	const tablesHolder = tables.filter((table) => {
		const hasNameRow = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('name'))
		const hasPercent = table.rows[0]?.some((col) => `${col}`.toLowerCase().includes('percent'))

		const titleLower = table.title.toLowerCase()
		const isTitleMatch =
			titleLower.includes('security') && titleLower.includes('owner') && titleLower.includes('beneficial')

		return isTitleMatch && hasNameRow && hasPercent
	})

	const foundHoldersKeys = new Set<string>()

	for (const table of tablesHolder) {
		const header = table.rows[0]
		const getIndex = (search: string) => header.findIndex((col) => `${col}`.toLowerCase().includes(search))
		const indexName = getIndex('name')
		const indexPercent = getIndex('percent')
		const indexShares = table.rows[1]?.findIndex((col) => typeof col === 'number' && !isNaN(col)) ?? -1

		for (let i = 1; i < table.rows.length; i++) {
			for (let i = 1; i < table.rows.length; i++) {
				const nameVal = table.rows[i]?.[indexName] ?? null
				if (typeof nameVal !== 'string') continue

				const nameParts = nameVal.split('}}')
				const namePartsSpaces = nameVal.split(' ')

				const position = nameParts[1] ?? namePartsSpaces.slice(2, namePartsSpaces.length).join(' ')
				const name = nameParts[1] ? nameParts[0] : namePartsSpaces.slice(0, 2).join(' ')

				const holder: Holder = {
					name: name.replace(/{{/g, '').replace(/}}/g, '').trim(),
					position: position.replace(/{{/g, '').replace(/}}/g, '').trim() || null,
					shares: Number(table.rows[i]?.[indexShares]) || null,
					percentOfClass: String(table.rows[i]?.[indexPercent]) || null,
				}

				const key = `${holder.name}${holder.position}${holder.shares}${holder.percentOfClass}`
				if (!foundHoldersKeys.has(key)) holderArr.push(holder)
				foundHoldersKeys.add(key)
			}
		}
	}

	for (const type of ['director', 'executive', 'summary']) {
		for (const table of findCompensationTables(type)) {
			if (!table) continue

			const header = table.rows[0]
			const getIndex = (search: string) => header.findIndex((col) => `${col}`.toLowerCase().includes(search))

			const indexName = getIndex('name')
			const indexYear = getIndex('year')
			const indexSalary = getIndex('salary') === -1 ? getIndex('cash') : getIndex('salary')
			const indexBonus = getIndex('bonus')
			const indexStock = getIndex('stock')
			const indexNonEquity = getIndex('non-equity') === -1 ? getIndex('option') : getIndex('non-equity')
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

				if (compensation.totalDollars !== null) {
					compensationArr.push(compensation)
				}
			}
		}
	}

	return { executiveCompensation: compensationArr, holders: holderArr }
}

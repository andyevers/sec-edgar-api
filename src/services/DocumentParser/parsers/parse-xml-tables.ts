import { XMLParams } from '../../../types'
import { HRNode, RowNode, TableNode } from '../XMLNode'
import XMLParser from '../XMLParser'

interface TableData {
	title: string
	rows: (string | number | null)[][]
}

export function parseXMLTables(params: XMLParams, xmlParser = new XMLParser()): TableData[] {
	const { xml } = params
	const documentNode = xmlParser.getDocumentNode({ xml })
	const tables = documentNode.getChildren().filter((c) => c instanceof TableNode) as TableNode[]

	const filterSpace = (str: string) =>
		str
			.replace(/\{\{|\}\}/g, '')
			.replace(/\n/g, ' ')
			.trim()

	const extractBold = (str: string) =>
		str
			.replace(/\n/g, '')
			.replace(/\}\}\{\{/g, ' | ')
			.replace(/&#160;|&nbsp;/g, ' ')
			.replace(/&#8211;/g, '- ')
			.match(/(?<=\{\{).*?(?=\}\})/g)
			?.join(' || ') ?? ''

	const parseValue = (str: string | null) => {
		if (str === null) return null

		const text = str
			.replace(/\n|&#160;|&nbsp;/g, ' ')
			.replace(/&#8211;|&#8212;/g, '- ')
			.replace(/\s+/, ' ')
			.trim()

		if (text === '') return null

		const colNum = text.replace(/,|\$|\(|\)|\%|\-/g, '').trim()
		if (!isNaN(Number(colNum))) {
			if (text.includes('%')) return `${colNum}%`
			return text.includes('(') || text.includes('-') ? Number(colNum) * -1 : Number(colNum)
		}
		return text
	}

	const result: TableData[] = []
	tables.forEach((table) => {
		// remove top empty children
		while (table.getChildren()[0]?.getIsEmpty()) {
			table.removeTopChild()
		}

		// set title using previous sibling text
		let previousSibling = table.getPreviousSibling()
		let sectionText = ''
		while (previousSibling && !(previousSibling instanceof HRNode) && !(previousSibling instanceof TableNode)) {
			sectionText = `${previousSibling.getText()} \n ${sectionText}`
			previousSibling = previousSibling.getPreviousSibling()
		}

		// if no section text but in the same section as another table, use the previous table's title
		const previousTitle = previousSibling instanceof TableNode ? previousSibling.getTitle() : null
		table.setTitle(sectionText === '' ? previousTitle ?? '' : extractBold(sectionText))

		// clone the header of the previous table if they are in the same section and this table is missing a header
		let headerRow = table.getHeaderRow()
		if (!headerRow && previousSibling instanceof TableNode && previousSibling.getHeaderRow()) {
			headerRow = (previousSibling.getHeaderRow() as RowNode).clone()
			table.prependChild(headerRow)
			table.setHeaderRow(headerRow)
		}

		// create rows
		let rows: string[][] = []
		if (headerRow) {
			for (const col of headerRow.getChildren()) {
				let colText = filterSpace(col.getText())
				let previousSibling = col.getTopSiblings()[0]

				// concat all text above the header row
				while (previousSibling && colText !== '') {
					const siblingText = filterSpace(previousSibling.getText())
					colText = siblingText !== '' ? `${siblingText} | ${colText}` : colText
					previousSibling = previousSibling.getTopSiblings()[0]
				}

				colText = colText.trim()
				col.setText(colText)
			}

			const headerRowIndex = table.getChildren().indexOf(headerRow)
			rows = headerRow.toTable().slice(headerRowIndex)
		} else {
			// if header row not found, use toArray which will create 1 column for each colspan
			rows = table.toArray() as string[][]
		}

		// filter out empty columns and parse values
		const colIndexes = rows[0]?.map((_, i) => i) ?? []
		const colIndexesEmpty = new Set(colIndexes.filter((i) => rows.every((r) => r[i] === '' || r[i] === null)))

		rows = rows
			.map((row) => row.filter((_, i) => !colIndexesEmpty.has(i)).map((col) => parseValue(col)))
			.filter((row) => !row.every((col) => col === '' || col === null) && row.length > 0) as any

		if (rows.length > 0) {
			result.push({
				title: table.getTitle() ?? '',
				rows: rows,
			})
		}
	})

	return result
}

import { TableData, XMLParams } from '../../../types'
import { HRNode } from '../XMLNode/HRNode'
import { NonTableNode } from '../XMLNode/NonTableNode'
import { TableNode } from '../XMLNode/TableNode'
import XMLParser from '../XMLParser'

export function parseForm10k(params: XMLParams, xmlParser = new XMLParser()): TableData[] {
	const { xml } = params

	const doc = xmlParser.getDocumentNode({ xml })
	const nodes = doc.getChildren()
	const tables = nodes.filter((child) => child instanceof TableNode) as TableNode[]

	let curSectionIndex = 0
	const sectionIndexByTable = new Map<TableNode, number>()
	const tableDataArr: TableData[] = []

	// map the section index of each table. new section starts for each <hr> tag.
	for (const node of nodes) {
		if (node instanceof TableNode) {
			sectionIndexByTable.set(node, curSectionIndex)
		} else if (node instanceof HRNode) {
			curSectionIndex++
		}
	}

	// create table arrays
	for (const table of tables) {
		table.mergeHeader()
		table.removeEmptyTopRows()

		const siblingsPrev = table.getSiblings({ dir: 'previous', stopAtType: NonTableNode, includeStopAtType: true })
		const siblingsNext = table.getSiblings({ dir: 'next', stopAtType: NonTableNode, includeStopAtType: true })

		// set the title based on the bold text in the previous siblings
		const title = siblingsPrev.map((s) => s.extractBold()).join(' | ')
		const textBefore = siblingsPrev.map((s) => s.getText()).join('\n')
		const textAfter = siblingsNext.map((s) => s.getText()).join('\n')

		const header = table.getHeaderRow()
		const headerTable = header?.toTable()

		const topRow = table.getChildren()[0]
		const topRowTable = !header ? topRow?.toTable() : null

		const prevTable = tableDataArr[tableDataArr.length - 1]
		const isSameTableSize = prevTable ? prevTable?.rows[0]?.length === topRowTable?.[0]?.length : false
		const isSameSection = prevTable ? prevTable.sectionIndex === sectionIndexByTable.get(table) : false
		const isSharedHeader = !!topRowTable && table.getTitle() === '' && isSameTableSize && isSameSection

		// some tables will be in the same section directly below another table and expected to have the same header.
		if (isSharedHeader) {
			topRowTable.unshift([...prevTable.rows[0]])
			table.setTitle(prevTable.title)
		}

		const rows = headerTable ?? topRowTable ?? []
		if (rows.length === 0) continue

		tableDataArr.push({
			title: title.trim(),
			sectionIndex: sectionIndexByTable.get(table) ?? -1,
			hasHeader: Boolean(header) || isSharedHeader,
			textBefore: textBefore,
			textAfter: textAfter,
			rows: rows.filter((r) => r.length === rows[0].length),
		})
	}

	return tableDataArr
}

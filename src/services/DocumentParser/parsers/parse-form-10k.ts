import { TableData, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

export function parseForm10k(params: XMLParams, xmlParser = new XMLParser()): TableData[] {
	const { xml } = params
	const doc = xmlParser.getDocumentNode({ xml })

	return doc.parseTables().map((table) => ({
		...table,
		rows: table.rows.map((row) =>
			row.map((col) => (typeof col === 'string' ? col.replace(/\{\{/g, '').replace(/\}\}/g, '') : col)),
		),
	}))
}

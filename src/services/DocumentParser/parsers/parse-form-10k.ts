import { Form10KData, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

export function parseForm10k(params: XMLParams, xmlParser = new XMLParser()): Form10KData {
	const { xml } = params
	const doc = xmlParser.getDocumentNode({ xml })

	const tables = doc.parseTables().map((table) => ({
		...table,
		rows: table.rows.map((row) =>
			row.map((col) => (typeof col === 'string' ? col.replace(/\{\{/g, '').replace(/\}\}/g, '') : col)),
		),
	}))

	return { tables }
}

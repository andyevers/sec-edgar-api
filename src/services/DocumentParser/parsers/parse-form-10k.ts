import { TableData, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

export function parseForm10k(params: XMLParams, xmlParser = new XMLParser()): TableData[] {
	const { xml } = params
	const doc = xmlParser.getDocumentNode({ xml })
	return doc.parseTables()
}

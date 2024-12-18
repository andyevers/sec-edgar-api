import { XMLParams } from '../../../types'
import XBRLParser, { ParseXbrlOptions, XbrlParseResult } from '../XBRLParser/XBRLParser'

export function parseXbrl(params: XMLParams & ParseXbrlOptions): XbrlParseResult {
	const parser = new XBRLParser()
	const { xml, ...options } = params
	return parser.parse(xml, options)
}

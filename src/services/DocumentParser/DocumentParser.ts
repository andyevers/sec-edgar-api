import { InsiderTransaction, XMLParams } from '../../types'
import XMLParser from './XMLParser'
import parsers from './parsers'

interface DocumentParserArgs {
	parser?: XMLParser
	parsersByName?: typeof parsers
}

export default class DocumentParser {
	private readonly parser: XMLParser
	private readonly parsersByName: typeof parsers

	constructor(args?: DocumentParserArgs) {
		const { parser = new XMLParser(), parsersByName = parsers } = args ?? {}
		this.parser = parser
		this.parsersByName = parsersByName
	}

	public parseInsiderTransactions(params: XMLParams): InsiderTransaction[] {
		return this.parsersByName.parseForm4(params, this.parser)
	}

	public parseHolders(params: XMLParams) {
		return this.parsersByName.parseForm13g(params, this.parser)
	}
}

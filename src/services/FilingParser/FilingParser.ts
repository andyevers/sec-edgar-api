import XMLParser from '../XMLParser'
import parsers from './parsers'

interface XMLParams {
	xml: string
}

interface FilingParserArgs {
	parser?: XMLParser
	parsersByName?: typeof parsers
}

export default class FilingParser {
	private readonly parser: XMLParser
	private readonly parsersByName: typeof parsers

	constructor(args?: FilingParserArgs) {
		const { parser = new XMLParser(), parsersByName = parsers } = args ?? {}
		this.parser = parser
		this.parsersByName = parsersByName
	}

	public parseInsiderTransactions(params: XMLParams) {
		const { xml } = params
		const textMap = this.parser.getTableTextMap({ xml })
		return this.parsersByName.parseForm4({ textMap })
	}
}

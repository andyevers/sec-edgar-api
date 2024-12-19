import { XMLParams } from '../../types'
import { GetDocumentXbrlParams } from '../SecEdgarApi'
import XMLParser from './XMLParserLegacy'
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

	public parseForm4(params: XMLParams) {
		return this.parsersByName.parseForm4(params, this.parser)
	}

	public parseForm13g(params: XMLParams) {
		return this.parsersByName.parseForm13g(params, this.parser)
	}

	public parseForm10k(params: XMLParams) {
		return this.parsersByName.parseForm10k(params, this.parser)
	}

	public parseFormDef14a(params: XMLParams) {
		return this.parsersByName.parseFormDef14a(params, this.parser)
	}

	public parseCurrentFilingsDaily(params: XMLParams) {
		return this.parsersByName.parseCurrentFilingsDaily(params)
	}

	public parseInsiderTransactions(params: XMLParams) {
		return this.parsersByName.parseInsiderTransactions(params)
	}

	public parseCompanies(params: XMLParams) {
		return this.parsersByName.parseCompanies(params)
	}

	public parseCurrentFilings(params: XMLParams) {
		return this.parsersByName.parseCurrentFilings(params)
	}

	public parseCurrentFilingsXbrl(params: XMLParams) {
		return this.parsersByName.parseCurrentFilingsXbrl(params)
	}

	public parseXbrl(params: XMLParams & GetDocumentXbrlParams) {
		return this.parsersByName.parseXbrl(params)
	}
}

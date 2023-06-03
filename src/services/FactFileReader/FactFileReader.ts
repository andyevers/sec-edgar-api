import * as fs from 'fs'
import { CompanyFactListData } from '../../types/company-facts.type'
import _cikBySymbol from '../../util/cik-by-symbol'

interface FileManager {
	readFileSync(path: string, encoding: string | object): string
}

interface FactFileReaderArgs {
	companyFactsDirname?: string
	cikBySymbol?: Record<string, number>
	fileManager?: FileManager
}

interface ReadFactFileParams {
	symbol: string
	companyFactsDirname: string
}

/**
 * Reads files from companyfacts folder from sec
 */
export default class FactFileReader {
	private readonly fileManager: FileManager
	private readonly cikBySymbol: Record<string, number>

	constructor(args?: FactFileReaderArgs) {
		const { fileManager = fs, cikBySymbol = _cikBySymbol } = args ?? {}
		this.fileManager = fileManager
		this.cikBySymbol = cikBySymbol
	}

	public getCikBySymbol() {
		return this.cikBySymbol
	}

	/**
	 * opens fact file from companyfacts directory
	 *
	 * @param symbol ex: AAPL
	 * @param companyFactsDirname ex: path.resolve(__dirname, './downloads/companyfacts')
	 */
	public readFactFile(params: ReadFactFileParams): CompanyFactListData {
		const { companyFactsDirname, symbol } = params
		const cik = this.cikBySymbol[symbol] ?? null
		if (!cik) {
			throw new Error(`No cik found for symbol ${symbol}`)
		}

		const cikStr = cik.toString().padStart(10, '0')
		const result = this.fileManager.readFileSync(`${companyFactsDirname}/CIK${cikStr}.json`, 'utf-8')

		return JSON.parse(result)
	}
}

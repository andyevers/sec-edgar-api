import { CompanyFactFrame, CompanyFactListData, MultiCompanyFactFrame } from '../../types'
import { SubmissionList } from '../../types/submission.type'
import _cikBySymbol from '../../util/cik-by-symbol'
import Client, { IClient } from '../Client'
import Throttler, { IThrottler } from './Throttler'

interface SecApiArgs {
	throttler: IThrottler
	client: IClient
	cikBySymbol: Record<string, number>
}

export interface GetSymbolParams {
	symbol: string
}

export interface GetFactParams {
	symbol: string
	fact: string
	taxonomy?: 'us-gaap' | 'dei' | 'invest' | string
}

export interface GetFactFrameParams {
	fact: string
	frame: string
	unit?: 'pure' | 'USD' | 'shares' | string
	taxonomy?: 'us-gaap' | 'dei' | 'invest' | string
}

export interface GetDocumentXMLParams {
	symbol: string
	accessionNumber: string
	primaryDocument: string
}

/**
 * Gets reports from companies filed with the SEC
 *
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
export default class SecConnector {
	private readonly throttler: IThrottler
	private readonly client: IClient
	private readonly cikBySymbol: Record<string, number>

	private readonly baseUrlEdgar = 'https://data.sec.gov'
	private readonly baseUrlSec = 'https://www.sec.gov'

	constructor(args: SecApiArgs = { client: new Client(), throttler: new Throttler(), cikBySymbol: _cikBySymbol }) {
		const { client, throttler, cikBySymbol } = args
		this.client = client
		this.throttler = throttler
		this.cikBySymbol = cikBySymbol
	}

	/**
	 * If symbol is not in cikBySymbol, assume it is a cik
	 */
	public getCikString(symbol: string) {
		const cik = this.cikBySymbol[symbol]
		if (cik) return cik.toString().padStart(10, '0')
		if (!isNaN(Number(symbol))) return Number(symbol).toString().padStart(10, '0')
		throw new Error(`${symbol} is not a known symbol or valid cik`)
	}

	private async request<T>(url: string, isText = false): Promise<T> {
		return new Promise(async (resolve, reject) => {
			this.throttler.add(async () => {
				try {
					const response = await this.client.request({
						url,
						onError: (err) => reject(err),
					})

					const responseData = response.data?.toString('utf-8') ?? null
					if (response.statusCode >= 400 || typeof responseData !== 'string') {
						reject(`Request failed with status ${response.statusCode} ${response.message}`)
					}

					resolve((isText ? (responseData as string) : JSON.parse(responseData as string)) as T)
				} catch (e) {
					reject(e)
				}
			})
		})
	}

	public async getSubmissions(params: GetSymbolParams): Promise<SubmissionList> {
		const { symbol } = params
		const cik = this.getCikString(symbol)
		return this.request(`${this.baseUrlEdgar}/submissions/CIK${cik}.json`)
	}

	public async getFact(params: GetFactParams): Promise<CompanyFactFrame> {
		const { symbol, fact, taxonomy = 'us-gaap' } = params
		const cik = this.getCikString(symbol)
		return this.request(`${this.baseUrlEdgar}/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${fact}.json`)
	}

	public async getFacts(params: GetSymbolParams): Promise<CompanyFactListData> {
		const { symbol } = params
		const cik = this.getCikString(symbol)
		return this.request(`${this.baseUrlEdgar}/api/xbrl/companyfacts/CIK${cik}.json`)
	}

	public async getFactFrame(params: GetFactFrameParams): Promise<MultiCompanyFactFrame> {
		const { fact, frame, taxonomy = 'us-gaap', unit = 'pure' } = params
		return this.request(`${this.baseUrlEdgar}/api/xbrl/frames/${taxonomy}/${fact}/${unit}/${frame}.json`)
	}

	public async getCompanyTickers() {
		return this.request(`${this.baseUrlSec}/files/company_tickers.json`)
	}

	public async getCompanyTickersMf() {
		return this.request(`${this.baseUrlSec}/files/company_tickers_mf.json`)
	}

	public async getCompanyTickersExchange() {
		return this.request(`${this.baseUrlSec}/files/company_tickers_exchange.json`)
	}

	public async getDataList() {
		return this.request(`${this.baseUrlSec}/data.json`) //
	}

	public async getDocumentXML(params: GetDocumentXMLParams) {
		const { accessionNumber, primaryDocument, symbol } = params
		const cik = this.cikBySymbol[symbol]
		return this.request<string>(
			`${this.baseUrlSec}/Archives/edgar/data/${cik}/${accessionNumber.replace(/-/g, '')}/${primaryDocument}`,
			true,
		)
	}

	public async getDocumentXMLByUrl(params: { url: string }) {
		return this.request<string>(params.url, true)
	}
}

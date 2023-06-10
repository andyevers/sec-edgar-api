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

export interface ISecConnector {
	getSubmissions(params: GetSymbolParams): Promise<SubmissionList>
	getFact(params: GetFactParams): Promise<CompanyFactFrame>
	getFacts(params: GetSymbolParams): Promise<CompanyFactListData>
	getFactFrame(params: GetFactFrameParams): Promise<MultiCompanyFactFrame>
}

/**
 * Gets reports from companies filed with the SEC
 *
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
export default class SecConnector implements ISecConnector {
	private readonly throttler: IThrottler
	private readonly client: IClient
	private readonly cikBySymbol: Record<string, number>

	constructor(args: SecApiArgs = { client: new Client(), throttler: new Throttler(), cikBySymbol: _cikBySymbol }) {
		const { client, throttler, cikBySymbol } = args
		this.client = client
		this.throttler = throttler
		this.cikBySymbol = cikBySymbol
	}

	private getCikString(symbol: string) {
		const cik = this.cikBySymbol[symbol] ?? ''
		return cik.toString().padStart(10, '0')
	}

	private async request<T>(path: string): Promise<T> {
		const baseUrl = 'https://data.sec.gov'

		return new Promise(async (resolve, reject) => {
			this.throttler.add(async () => {
				try {
					const response = await this.client.request({
						url: `${baseUrl}${path}`,
						onError: (err) => reject(err),
					})

					const responseData = response.data?.toString('utf-8') ?? null
					if (response.statusCode >= 400 || typeof responseData !== 'string') {
						reject(`Request failed with status ${response.statusCode} ${response.message}`)
					}

					resolve(JSON.parse(responseData as string) as T)
				} catch (e) {
					reject(e)
				}
			})
		})
	}

	public async getSubmissions(params: GetSymbolParams): Promise<SubmissionList> {
		const { symbol } = params
		const cik = this.getCikString(symbol)
		return this.request(`/submissions/CIK${cik}.json`)
	}

	public async getFact(params: GetFactParams): Promise<CompanyFactFrame> {
		const { symbol, fact, taxonomy = 'us-gaap' } = params
		const cik = this.getCikString(symbol)
		return this.request(`/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${fact}.json`)
	}

	public async getFacts(params: GetSymbolParams): Promise<CompanyFactListData> {
		const { symbol } = params
		const cik = this.getCikString(symbol)
		return this.request(`/api/xbrl/companyfacts/CIK${cik}.json`)
	}

	public async getFactFrame(params: GetFactFrameParams): Promise<MultiCompanyFactFrame> {
		const { fact, frame, taxonomy = 'us-gaap', unit = 'pure' } = params
		return this.request(`/api/xbrl/frames/${taxonomy}/${fact}/${unit}/${frame}.json`)
	}
}

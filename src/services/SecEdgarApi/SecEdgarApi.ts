import {
	CompanyFactFrame,
	CompanyFactListData,
	CompanyTickerItem,
	FieldDataResponse,
	Form10KData,
	Form13GData,
	Form4Data,
	FormDef14aData,
	MultiCompanyFactFrame,
	ReportRaw,
	ReportTranslated,
} from '../../types'
import { FilingListDetails, FilingListItemTranslated, SubmissionList } from '../../types/submission.type'
import _cikBySymbol from '../../util/cik-by-symbol'
import Client, { IClient } from '../Client'
import DocumentParser from '../DocumentParser'
import ReportParser from '../ReportParser'
// import { ParseReportsOptions } from '../ReportParser/ReportRawParser'
import ReportWrapper from '../ReportParser/ReportWrapper'
import SubmissionRequestWrapper, { SendRequestParams } from './RequestWrapper'
import Throttler, { IThrottler } from './Throttler'

interface BuildReportsByAccn {
	[accn: string]: ReportRaw
}

interface SecApiArgs {
	throttler: IThrottler
	client: IClient
	cikBySymbol: Record<string, number>
	reportParser: ReportParser
	documentParser: DocumentParser
}

export interface CreateRequestWrapperParams {
	/** symbol or cik */
	symbol: string | number
	filings: FilingListDetails | FilingListItemTranslated[]
	/** earliest allowed filing date that is allowed to be fetched */
	cutoffDate?: Date
	maxRequests?: number
}

export interface GetSymbolParams {
	/** symbol or cik */
	symbol: string | number
}

export interface GetReportsRawParams {
	symbol: string | number
	includeNamePrefix?: boolean
	adjustForSplits?: boolean
	resolvePeriodValues?: boolean
}

export interface GetReportsParams extends Omit<GetReportsRawParams, 'includeNamePrefix'> {
	/** symbol or cik */
	symbol: string | number
	withWrapper?: boolean
	usePropertyResolver?: boolean
	adjustForSplits?: boolean
	resolvePeriodValues?: boolean
}

export interface GetFactParams {
	/** symbol or cik */
	symbol: string | number
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
	/** symbol or cik */
	symbol: string | number
	accessionNumber: string
	primaryDocument: string
}

export interface GetSubmissionsParams {
	/** symbol or cik */
	symbol: string
	includeTranslated?: boolean
}

/**
 * Gets reports from companies filed with the SEC
 *
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
export default class SecEdgarApi {
	private readonly baseUrlEdgar: string
	private readonly baseUrlSec: string

	private readonly throttler: IThrottler
	private readonly client: IClient

	public readonly cikBySymbol: Record<string, number>
	public readonly reportParser: ReportParser
	public readonly documentParser: DocumentParser

	constructor(
		args: SecApiArgs = {
			client: new Client(),
			throttler: new Throttler(),
			cikBySymbol: _cikBySymbol,
			reportParser: new ReportParser(),
			documentParser: new DocumentParser(),
		},
	) {
		const { client, throttler, cikBySymbol, reportParser, documentParser } = args
		this.client = client
		this.throttler = throttler
		this.cikBySymbol = cikBySymbol
		this.reportParser = reportParser
		this.documentParser = documentParser

		this.baseUrlEdgar = 'https://data.sec.gov'
		this.baseUrlSec = 'https://www.sec.gov'
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

	private mapFilingListDetails(cik: string | number, filingListDetails: FilingListDetails) {
		const filings: FilingListItemTranslated[] = []

		for (const key in filingListDetails) {
			const k = key as keyof FilingListDetails
			const dataArr = filingListDetails[k]

			for (let i = 0; i < dataArr.length; i++) {
				filings[i] = filings[i] ?? {}
				const filing = filings[i] as unknown as Record<string, string | number>
				filing[k] = dataArr[i]
			}
		}

		for (const filing of filings) {
			const accessionStr = filing.accessionNumber.replace(/-/g, '')
			const primaryDocument = filing.primaryDocument
			filing.url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionStr}/${primaryDocument}`
		}

		return filings
	}

	private getCreateRequestSubmissions(params: CreateRequestWrapperParams, forms: string[]) {
		const { symbol, filings, cutoffDate = new Date('1970-01-01') } = params
		const cik = this.getCikString(symbol)
		const filingsArr = Array.isArray(filings) ? filings : this.mapFilingListDetails(cik, filings)
		return filingsArr.filter(
			({ form, filingDate }) => forms.includes(form) && new Date(filingDate).getTime() > cutoffDate.getTime(),
		)
	}

	/**
	 * If symbol is not in cikBySymbol, assume it is a cik. does not make a request
	 */
	public getCikString(symbol: string | number) {
		const cik = this.cikBySymbol[symbol]
		if (cik) return cik.toString().padStart(10, '0')
		if (!isNaN(Number(symbol))) return Number(symbol).toString().padStart(10, '0')
		throw new Error(`${symbol} is not a known symbol or valid cik`)
	}

	/**
	 * This JSON data structure contains metadata such as current name, former name,
	 * and stock exchanges and ticker symbols of publicly-traded companies. The object’s
	 * property path contains at least one year’s of filing or to 1,000 (whichever is more)
	 * of the most recent filings in a compact columnar data array. If the entity has
	 * additional filings, files will contain an array of additional JSON files and the
	 * date range for the filings each one contains.
	 *
	 * endpoint: `/submissions/CIK${cik}.json`
	 */
	public async getSubmissions(params: GetSubmissionsParams): Promise<SubmissionList> {
		const { symbol, includeTranslated } = params
		const cik = this.getCikString(symbol)
		const submissions = await this.request<SubmissionList>(`${this.baseUrlEdgar}/submissions/CIK${cik}.json`)
		submissions.cik = Number(submissions.cik)

		if (!includeTranslated) return submissions
		submissions.filings.recentTranslated = this.mapFilingListDetails(cik, submissions.filings.recent)

		return submissions
	}

	/**
	 * The company-concept API returns all the XBRL disclosures from a single company (CIK)
	 * and concept (a taxonomy and tag) into a single JSON file, with a separate array
	 * of facts for each units on measure that the company has chosen to disclose
	 * (e.g. net profits reported in U.S. dollars and in Canadian dollars).
	 *
	 * endpoint `/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${fact}.json`
	 */
	public async getFact(params: GetFactParams): Promise<CompanyFactFrame> {
		const { symbol, fact, taxonomy = 'us-gaap' } = params
		const cik = this.getCikString(symbol)
		return this.request(`${this.baseUrlEdgar}/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${fact}.json`)
	}

	/**
	 * Returns all the company concepts data for a company into a single API call:
	 *
	 * endpoint `/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${fact}.json`
	 */
	public async getFacts(params: GetSymbolParams): Promise<CompanyFactListData> {
		const { symbol } = params
		const cik = this.getCikString(symbol)
		return this.request(`${this.baseUrlEdgar}/api/xbrl/companyfacts/CIK${cik}.json`)
	}

	/**
	 * The xbrl/frames API aggregates one fact for each reporting entity that is last filed
	 * that most closely fits the calendrical period requested. This API supports for annual,
	 * quarterly and instantaneous data:
	 *
	 * data.sec.gov/api/xbrl/frames/us-gaap/AccountsPayableCurrent/USD/CY2019Q1I.json
	 *
	 * Where the units of measure specified in the XBRL contains a numerator and a denominator,
	 * these are separated by “-per-” such as “USD-per-shares”. Note that the default unit
	 * in XBRL is “pure”.
	 *
	 * The period format is CY#### for annual data (duration 365 days +/- 30 days), CY####Q#
	 * for quarterly data (duration 91 days +/- 30 days), and CY####Q#I for instantaneous data.
	 * Because company financial calendars can start and end on any month or day and even
	 * change in length from quarter to quarter to according to the day of the week, the frame
	 * data is assembled by the dates that best align with a calendar quarter or year. Data
	 * users should be mindful different reporting start and end dates for facts contained
	 * in a frame.
	 *
	 * endpoint `/api/xbrl/frames/${taxonomy}/${fact}/${unit}/${frame}.json`
	 */
	public async getFactFrame(params: GetFactFrameParams): Promise<MultiCompanyFactFrame> {
		const { fact, frame, taxonomy = 'us-gaap', unit = 'pure' } = params
		return this.request(`${this.baseUrlEdgar}/api/xbrl/frames/${taxonomy}/${fact}/${unit}/${frame}.json`)
	}

	/**
	 * Note: Properties that are not provied from report are calculated an may not be accurate,
	 * verify results finance.yahoo.com (ex: https://finance.yahoo.com/quote/AAPL/financials)
	 *
	 * Please contribute to improve resolving report properties: https://github.com/andyevers/sec-edgar-api
	 *
	 * Parses reports from company facts. Calculates missing properties and uses a single interface
	 * for all reports. This includes only 10-K and 10-Q annual and quarterly reports. To include
	 * all reports, use getReportsRaw.
	 */
	public async getReports<T extends GetReportsParams>(
		params: T,
	): Promise<T['withWrapper'] extends true ? ReportWrapper[] : ReportTranslated[]> {
		const { withWrapper = false, usePropertyResolver = true } = params
		const reportsRaw = await this.getReportsRaw({ ...params, includeNamePrefix: false })
		const reports = this.reportParser.parseReportsFromRaw(reportsRaw, usePropertyResolver)
		return withWrapper ? reports : (reports.map((report) => report.getReport()) as any)
	}

	/**
	 * Parses reports from company facts. Calculates missing properties and uses a single interface
	 * for all reports.
	 */
	public async getReportsRaw(params: GetReportsRawParams): Promise<ReportRaw[]> {
		const { symbol, includeNamePrefix = false, adjustForSplits = true, resolvePeriodValues = true } = params
		const companyFacts = await this.getFacts({ symbol })
		const reports = this.reportParser.parseReportsRaw(companyFacts, {
			adjustForSplits,
			resolvePeriodValues,
			includeNamePrefix,
		})
		return reports
	}

	/**
	 * Gets a list of all tickers and CIKs from `https://www.sec.gov/files/company_tickers.json`
	 *
	 * Note that they key cik_str is actually a number. To get cik string, you can do `${cik_str}`.padStart(10, '0')
	 */
	public async getCompanyTickerList(): Promise<CompanyTickerItem[]> {
		const response = await this.request(`${this.baseUrlSec}/files/company_tickers.json`)
		return Object.values(response as Record<string, CompanyTickerItem>)
	}

	/**
	 * Gets a list of all tickers and CIKs with exchange and company name from `https://www.sec.gov/files/company_tickers_exchange.json`
	 *
	 * response: { fields: ['cik', 'name', 'ticker', 'exchange'], data: [ [320193,'Apple Inc.','AAPL','Nasdaq'], ... ] }
	 */
	public async getCompanyTickerExchangeList(): Promise<FieldDataResponse<'cik' | 'name' | 'ticker' | 'exchange'>> {
		return this.request(`${this.baseUrlSec}/files/company_tickers_exchange.json`)
	}

	/**
	 * Gets a list of all mutual funds from `https://www.sec.gov/files/company_tickers_mf.json`
	 *
	 * response: { fields: ['cik','seriesId','classId','symbol'], data: [ [2110,'S000009184','C000024954','LACAX'], ... ] }
	 */
	public async getMutualFundList(): Promise<FieldDataResponse<'cik' | 'seriesId' | 'classId' | 'symbol'>> {
		return this.request(`${this.baseUrlSec}/files/company_tickers_mf.json`)
	}

	/**
	 * Gets a raw xml document string. the parameters are found in the submission list response. (response.filings.recent or response.filings.recentTranslated)
	 *
	 * Some form types can be parsed using the DocumentParser such as form 4 (insider transactions) and form 13g (institutional holders)
	 *
	 * endpoint: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber}/${primaryDocument}`
	 *
	 * @see https://www.sec.gov/forms for a list of form types
	 */
	public async getDocumentXML(params: GetDocumentXMLParams) {
		const { accessionNumber, primaryDocument, symbol } = params
		const cik = this.cikBySymbol[symbol]
		return this.request<string>(
			`${this.baseUrlSec}/Archives/edgar/data/${cik}/${accessionNumber.replace(/-/g, '')}/${primaryDocument}`,
			true,
		)
	}

	/**
	 * Gets a raw xml document string. the url is found in the submission list response. (response.filings.recentTranslated.url)
	 *
	 * Some form types can be parsed using the DocumentParser such as form 4 (insider transactions) and form 13g (institutional holders)
	 *
	 * endpoint: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber}/${primaryDocument}`
	 *
	 * @see https://www.sec.gov/forms for a list of form types
	 */
	public async getDocumentXMLByUrl(params: { url: string }) {
		return this.request<string>(params.url, true)
	}

	/**
	 * Used for getting insider transactions. extracts insider transaction urls from submission list response, and parses the xml doc.
	 *
	 * ```ts
	 * const submissions = await secEdgarApi.getSubmissions({ symbol: 'AAPL' })
	 * const requestWrapper = secEdgarApi.createRequestInsiderTransactions({ symbol: 'AAPL', filings: submissions.filings.recent })
	 *
	 * const transactions1 = (await requestWrapper.requestNext()).result.transactions // array of transactions from most recent doc
	 * const transactions2 = (await requestWrapper.requestNext()).result.transactions // array of transactions from second most recent doc
	 * ```
	 */
	public createRequestInsiderTransactions(params: CreateRequestWrapperParams): SubmissionRequestWrapper<Form4Data> {
		const submissions = this.getCreateRequestSubmissions(params, ['4', '4/A', '5', '5/A'])
		const options = { maxRequests: params.maxRequests }
		const sendRequest = async (params: SendRequestParams) =>
			this.documentParser.parseForm4({ xml: await this.getDocumentXMLByUrl(params) })

		return new SubmissionRequestWrapper<Form4Data>({ submissions, options, sendRequest })
	}

	/**
	 * Used for getting institutional holders. extracts holders urls from submission list response, and parses the xml doc.
	 *
	 * ```ts
	 * const submissions = await secEdgarApi.getSubmissions({ symbol: 'AAPL' })
	 * const requestWrapper = secEdgarApi.createRequestInstitutionalHolders({ symbol: 'AAPL', filings: submissions.filings.recent })
	 *
	 * const holders1 = (await requestWrapper.requestNext()).result.holders // array of holders from most recent doc
	 * const holders2 = (await requestWrapper.requestNext()).result.holders // array of holders from second most recent doc
	 * ```
	 */
	public createRequestInstitutionalHolders(
		params: CreateRequestWrapperParams,
	): SubmissionRequestWrapper<Form13GData> {
		const submissions = this.getCreateRequestSubmissions(params, ['SC 13G', 'SC 13G/A'])
		const options = { maxRequests: params.maxRequests }
		const sendRequest = async (params: SendRequestParams) =>
			this.documentParser.parseForm13g({ xml: await this.getDocumentXMLByUrl(params) })

		return new SubmissionRequestWrapper<Form13GData>({ submissions, options, sendRequest })
	}

	/**
	 * Used for getting earnings report tables from submission files.
	 *
	 * ```ts
	 * const submissions = await secEdgarApi.getSubmissions({ symbol: 'AAPL' })
	 * const requestWrapper = secEdgarApi.createRequesEarningsReports({ symbol: 'AAPL', filings: submissions.filings.recent })
	 *
	 * const tables1 = (await requestWrapper.requestNext()).result.tables // array of tables from most recent doc
	 * const tables2 = (await requestWrapper.requestNext()).result.tables // array of tables from second most recent doc
	 * ```
	 */
	public createRequestEarningsReports(params: CreateRequestWrapperParams): SubmissionRequestWrapper<Form10KData> {
		const submissions = this.getCreateRequestSubmissions(params, ['10-Q', '10-Q/A', '10-K', '10-K/A'])
		const options = { maxRequests: params.maxRequests }
		const sendRequest = async (params: SendRequestParams) =>
			this.documentParser.parseForm10k({ xml: await this.getDocumentXMLByUrl(params) })

		return new SubmissionRequestWrapper<Form10KData>({ submissions, options, sendRequest })
	}

	/**
	 * Proxy statement includes list of holders, executiveCompensation, and other tables. returns FormDef14aData
	 *
	 * ```ts
	 * const submissions = await secEdgarApi.getSubmissions({ symbol: 'AAPL' })
	 * const requestWrapper = secEdgarApi.createRequesProxyStatement({ symbol: 'AAPL', filings: submissions.filings.recent })
	 *
	 * const { holders, executiveCompensation } = (await requestWrapper.requestNext()).result
	 * ```
	 */
	public createRequestProxyStatement(params: CreateRequestWrapperParams): SubmissionRequestWrapper<FormDef14aData> {
		const submissions = this.getCreateRequestSubmissions(params, ['DEF 14A'])
		const options = { maxRequests: params.maxRequests }
		const sendRequest = async (params: SendRequestParams) =>
			this.documentParser.parseFormDef14a({ xml: await this.getDocumentXMLByUrl(params) })

		return new SubmissionRequestWrapper<FormDef14aData>({ submissions, options, sendRequest })
	}
}

import { CompanyFactFrame, CompanyFactListData, MultiCompanyFactFrame, ReportRaw, SubmissionList } from '../../types'
import ReportParser from '../ReportParser'
import { ParseReportsOptions } from '../ReportParser/ReportRawParser'
import ReportWrapper from '../ReportParser/ReportWrapper'
import FactsDownloader, { DownloadCompanyFactsDirectoryParams, IFactsDownloader } from './FactsDownloader'
import SecConnector, { GetFactFrameParams, GetFactParams, GetSymbolParams, ISecConnector } from './SecConnector'

interface SecEdgarApiArgs {
	secConnector: ISecConnector
	reportParser: ReportParser
	factsDownloader: IFactsDownloader
}

/**
 * Gets company reports and filings from the SEC EDGAR API
 *
 * Requests are throttled with 120ms delay between requests to avoid rate limiting
 *
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
export default class SecEdgarApi {
	private readonly reportParser: ReportParser
	private readonly secConnector: ISecConnector
	private readonly factsDownloader: IFactsDownloader

	constructor(
		args: SecEdgarApiArgs = {
			secConnector: new SecConnector(),
			reportParser: new ReportParser(),
			factsDownloader: new FactsDownloader(),
		},
	) {
		const { secConnector, reportParser, factsDownloader } = args
		this.secConnector = secConnector
		this.reportParser = reportParser
		this.factsDownloader = factsDownloader
	}

	/**
	 * endpoint: /submissions/CIK${cik}.json
	 *
	 * This JSON data structure contains metadata such as current name, former name,
	 * and stock exchanges and ticker symbols of publicly-traded companies. The object’s
	 * property path contains at least one year’s of filing or to 1,000 (whichever is more)
	 * of the most recent filings in a compact columnar data array. If the entity has
	 * additional filings, files will contain an array of additional JSON files and the
	 * date range for the filings each one contains.
	 */
	public async getSubmissions(params: GetSymbolParams): Promise<SubmissionList> {
		return this.secConnector.getSubmissions(params)
	}

	/**
	 * endpoint /api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${fact}.json
	 *
	 * This API returns all the company concepts data for a company into a single API call:
	 */
	public async getFacts(params: GetSymbolParams): Promise<CompanyFactListData> {
		return this.secConnector.getFacts(params)
	}

	/**
	 * endpoint /api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${fact}.json
	 *
	 * The company-concept API returns all the XBRL disclosures from a single company (CIK)
	 * and concept (a taxonomy and tag) into a single JSON file, with a separate array
	 * of facts for each units on measure that the company has chosen to disclose
	 * (e.g. net profits reported in U.S. dollars and in Canadian dollars).
	 */
	public async getFact(params: GetFactParams): Promise<CompanyFactFrame> {
		return this.secConnector.getFact(params)
	}

	/**
	 * endpoint /api/xbrl/frames/${taxonomy}/${fact}/${unit}/${frame}.json
	 *
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
	 */
	public async getFactFrame(params: GetFactFrameParams): Promise<MultiCompanyFactFrame> {
		return this.secConnector.getFactFrame(params)
	}

	/**
	 * Parses reports from company facts. Calculates missing properties and uses a single interface
	 * for all reports. This includes only 10-K and 10-Q annual and quarterly reports. To include
	 * all reports, use getReportsRaw
	 *
	 * Note that calculated properties are estimated if they are not available in the company facts.
	 */
	public async getReports(params: GetSymbolParams): Promise<ReportWrapper[]> {
		const facts = await this.getFacts(params)
		return this.reportParser.parseReports(facts)
	}

	/**
	 * Parses reports from company facts. Calculates missing properties and uses a single interface
	 * for all reports.
	 */
	public async getReportsRaw(params: GetSymbolParams & ParseReportsOptions): Promise<ReportRaw[]> {
		const facts = await this.getFacts(params)
		return this.reportParser.parseReportsRaw(facts)
	}

	/**
	 * Downloads the companyfacts.zip file and extracts the directory containing all company
	 * reports available from sec.gov. After downloading, you can use factFileReader and reportParser
	 * to get and read reports.
	 */
	public async downloadCompanyFactsDirectory(params: DownloadCompanyFactsDirectoryParams): Promise<boolean> {
		return this.factsDownloader.downloadCompanyFactsDirectory(params)
	}
}

import { CompanyFactListData, ReportRaw, ReportTranslated } from '../../types'
import _keyTranslator from '../../util/key-translations'
import { IterateFactsCallbackData } from './FactIterator'
import PropertyResolver from './PropertyResolver'
import ReportRawParser, { ParseReportsOptions } from './ReportRawParser'
import ReportWrapper from './ReportWrapper'

interface ReportParserArgs {
	reportRawParser?: ReportRawParser
	propertyResolver?: PropertyResolver
	keyTranslator?: Record<string, string[]>
}

type TranslateRawReportsCallback<T> = (
	report: T extends undefined ? ReportTranslated : Record<keyof T, string | number>,
	reportRaw: ReportRaw,
	keyTranslator: T,
) => any

/**
 * Takes company facts data from the SEC and translates them to reports as json objects.
 */
export default class ReportParser {
	private readonly reportRawParser: ReportRawParser
	private readonly keyTranslator: Record<string, string[]>
	private readonly propertyResolver: PropertyResolver

	constructor(args?: ReportParserArgs) {
		const {
			reportRawParser = new ReportRawParser(),
			propertyResolver = new PropertyResolver(),
			keyTranslator = _keyTranslator,
		} = args ?? {}
		this.reportRawParser = reportRawParser
		this.keyTranslator = keyTranslator
		this.propertyResolver = propertyResolver
	}

	/**
	 * translates company facts to ReportTranslated. To translate to custom report, use parseReportsRaw and translateReportsRaw
	 *
	 * This includes only 10-K and 10-Q annual and quarterly reports. To include all reports, use parseReportsRaw
	 *
	 * @param companyFactListData This is the json file contents of CIK[number].json file from the SEC website. You can find these using their API or by downloading the companyfacts.zip file: https://www.sec.gov/edgar/sec-api-documentation
	 */
	public parseReports(companyFactListData: Pick<CompanyFactListData, 'facts'>): ReportWrapper[] {
		const reportsRaw = this.reportRawParser.parseReports(companyFactListData, {
			reportsToInclude: ['ANNUAL', 'QUARTERLY'],
		})

		return this.parseReportsFromRaw(reportsRaw)
	}

	/**
	 * Same as parseReports but accepts ReportRaw[] instead of CompanyFactListData
	 */
	public parseReportsFromRaw(reportsRaw: ReportRaw[]): ReportWrapper[] {
		const reportByYearQuarter = new Map<string, ReportWrapper>()

		const reportsRawFiltered = reportsRaw.filter((reportRaw) => {
			return reportRaw.reportType === 'ANNUAL' || reportRaw.reportType === 'QUARTERLY'
		})

		this.translateReportsRaw(reportsRawFiltered, (report, reportRaw) => {
			const { fiscalPeriod, fiscalYear } = report
			const keyReport = `${fiscalYear}_${fiscalPeriod}`
			reportByYearQuarter.set(keyReport, new ReportWrapper(report, reportRaw, reportByYearQuarter))
			return report
		})

		const reportWrappers = Array.from(reportByYearQuarter.values())
		this.propertyResolver.resolveAll(reportWrappers)

		return reportWrappers
	}

	/**
	 * Note that this includes all reports by default, not just annual and quarterly. use options.reportsToInclude to filter
	 *
	 * @see https://www.sec.gov/edgar/sec-api-documentation
	 */
	public parseReportsRaw(
		companyFactListData: Pick<CompanyFactListData, 'facts'>,
		options?: ParseReportsOptions,
	): ReportRaw[] {
		return this.reportRawParser.parseReports(companyFactListData, options)
	}

	/**
	 * parseReportsRaw but removes meta data from the report
	 */
	public parseReportsRawNoMeta(
		companyFactListData: Pick<CompanyFactListData, 'facts'>,
		options?: ParseReportsOptions,
	): Record<string, number>[] {
		const reportsRaw = this.parseReportsRaw(companyFactListData, options)
		reportsRaw.forEach((reportRaw) => {
			const report = reportRaw as any
			delete report.dateFiled
			delete report.dateReport
			delete report.fiscalPeriod
			delete report.fiscalYear
			delete report.form
			delete report.frame
			delete report.isTTM
			delete report.reportType
			delete report.taxonomy
		})

		return reportsRaw as unknown as Record<string, number>[]
	}

	/**
	 * Avoids deep nesting logic while iteratating through company facts
	 *
	 * @param callback called on each company fact.
	 */
	public iterateCompanyFacts(
		companyFactListData: Pick<CompanyFactListData, 'facts'>,
		callback: (data: IterateFactsCallbackData) => void,
	) {
		this.reportRawParser.iterateCompanyFacts(companyFactListData, callback)
	}

	/**
	 * Translate ReportRaw to ReportTranslated by default, but can be used to translate to any object using both the callback and keyTranslator
	 *
	 * @param reportsRaw this is the output of parseReportsRaw
	 * @param callback this is called for each report and can be used to modify the report. This gets the report built by keyTranslator if provided, otherwise ReportTranslated
	 * @param keyTranslator this is iterated through to build the report using the keys. If the ReportRaw has a key that matches a key in the keyTranslator, the value is used. if not, the value is null
	 */
	public translateReportsRaw<C extends TranslateRawReportsCallback<T>, T extends undefined | object = undefined>(
		reportsRaw: ReportRaw[],
		callback?: C,
		keyTranslator?: T,
	): C extends unknown ? ReportTranslated[] : ReturnType<C>[] {
		const keyTranslations = (keyTranslator ?? this.keyTranslator) as Record<string, string[]>
		const reports: Record<string, string | number | null>[] = []

		reportsRaw.forEach((reportRaw) => {
			const reportNew: Record<string, string | number | null | boolean> = {}

			// iterate translation keys, ensuring same order and priority
			for (const key in keyTranslations) {
				const keysRaw = keyTranslations[key]
				reportNew[key] = null

				for (const keyRaw of keysRaw) {
					if (reportRaw[keyRaw] === undefined) continue
					reportNew[key] = reportRaw[keyRaw]
					break
				}
			}

			const reportFiltered = callback
				? callback(reportNew as Parameters<C>[0], reportRaw, keyTranslations as Parameters<C>[2])
				: reportNew

			reports.push(reportFiltered)
		})

		return reports as C extends unknown ? ReportTranslated[] : ReturnType<C>[]
	}
}

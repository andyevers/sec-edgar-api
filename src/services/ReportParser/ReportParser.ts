import type { CalculationMap, CompanyFactListData, ReportRaw, ReportTranslated } from '../../types'
import { calculationMapCondensed } from '../../util/calculation-map'
import _keyTranslator from '../../util/key-translations'
import { utilMap } from '../../util/util-map'
import ReportRawBuilder from '../ReportRawBuilder'
import { BuildReportsParams } from '../ReportRawBuilder/ReportRawBuilder'
import PropertyResolver from './PropertyResolver'
import ReportResolvable from './ReportResolvable'
import ReportWrapper from './ReportWrapper'

interface ReportParserArgs {
	reportBuilder?: ReportRawBuilder
	propertyResolver?: PropertyResolver
	keyTranslator?: Record<string, string[]>
	defaultCalculationMap?: CalculationMap<ReportTranslated>
}

type TranslateRawReportsCallback<T> = (
	report: T extends undefined ? ReportTranslated : Record<keyof T, string | number>,
	reportRaw: ReportRaw,
	keyTranslator: T,
) => ReportTranslated | ReportRaw | Record<string, string | number | null>

/**
 * Takes company facts data from the SEC and translates them to reports as json objects.
 */
export default class ReportParser {
	private readonly keyTranslator: Record<string, string[]>
	private readonly propertyResolver: PropertyResolver
	private readonly reportBuilder: ReportRawBuilder
	private defaultCalculationMap: CalculationMap<ReportTranslated>

	constructor(args?: ReportParserArgs) {
		const {
			propertyResolver = new PropertyResolver(),
			reportBuilder = new ReportRawBuilder(),
			keyTranslator = _keyTranslator,
			defaultCalculationMap = utilMap.expandMap(calculationMapCondensed),
		} = args ?? {}
		this.keyTranslator = keyTranslator
		this.propertyResolver = propertyResolver
		this.reportBuilder = reportBuilder
		this.defaultCalculationMap = defaultCalculationMap
	}

	/**
	 * Same as parseReports but accepts ReportRaw[] instead of CompanyFactListData
	 *
	 * @deprecated Formerly parseReportsFromRaw. Will be removed in future version.
	 */
	public parseReportsFromRawLegacy(params: {
		reportsRaw: ReportRaw[]
		usePropertyResolver?: boolean
	}): ReportWrapper[] {
		const { reportsRaw, usePropertyResolver = true } = params
		const reportByYearQuarter = new Map<string, ReportWrapper>()

		const reportsRawFiltered = reportsRaw

		this.translateReportsRaw(reportsRawFiltered, (report, reportRaw) => {
			const { fiscalPeriod, fiscalYear } = report
			const keyReport = `${fiscalYear}_${fiscalPeriod}`
			reportByYearQuarter.set(keyReport, new ReportWrapper(report, reportRaw, reportByYearQuarter))
			return report
		})

		const reportWrappers = Array.from(reportByYearQuarter.values())

		if (usePropertyResolver) {
			this.propertyResolver.resolveAll(reportWrappers)
		}

		return reportWrappers
	}

	/**
	 * Same as parseReports but accepts ReportRaw[] instead of CompanyFactListData
	 */
	public translateReports<T = ReportTranslated>(params: {
		reports: ReportRaw[]
		calculationMap?: CalculationMap<T>
	}): (ReportRaw & T)[] {
		const { reports, calculationMap } = params

		const calcMap = calculationMap ?? this.defaultCalculationMap
		return reports.map((report) => {
			const reportNew: ReportRaw = {
				cik: report.cik,
				dateFiled: report.dateFiled,
				dateReport: report.dateReport,
				fiscalPeriod: report.fiscalPeriod,
				url: report.url,
				fiscalYear: report.fiscalYear,
				splitDate: report.splitDate,
				splitRatio: report.splitRatio,
			}

			const reportResolvable = new ReportResolvable({
				report,
				calculationMap: calcMap,
			})

			for (const key in calcMap) {
				const value = reportResolvable.get(key) ?? null
				reportNew[key] = value as string | number | null
			}

			return reportNew as T & ReportRaw
		})
	}

	/**
	 * Parse raw reports
	 *
	 * @see https://www.sec.gov/edgar/sec-api-documentation
	 */
	public parseReportsRaw(
		companyFactListData: CompanyFactListData,
		options: Omit<BuildReportsParams, 'facts'> & { includeNamePrefix?: boolean },
	): ReportRaw[] {
		const { includeNamePrefix } = options
		const { facts } = this.reportBuilder.createFacts(companyFactListData, includeNamePrefix)
		return this.reportBuilder.buildReports({
			facts,
			...options,
		})
	}

	/**
	 * Builds ReportRaw[] from facts
	 */
	public buildReports(params: BuildReportsParams): ReportRaw[] {
		return this.reportBuilder.buildReports(params)
	}

	/**
	 * @deprecated use translateReports
	 *
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
		const reports: (ReportTranslated | Record<string, string | number | null>)[] = []

		reportsRaw.forEach((report) => {
			const reportNew: Record<string, string | number | null | boolean> = {}

			// iterate translation keys, ensuring same order and priority
			for (const key in keyTranslations) {
				const keysRaw = keyTranslations[key]
				reportNew[key] = null
				for (const keyRaw of keysRaw) {
					const value = report[keyRaw]
					if (value === undefined) continue
					reportNew[key] = value
					break
				}
			}

			const reportFiltered = callback
				? callback(reportNew as Parameters<C>[0], report, keyTranslations as Parameters<C>[2])
				: reportNew

			reports.push(reportFiltered as ReportTranslated)
		})

		return reports as C extends unknown ? ReportTranslated[] : ReturnType<C>[]
	}
}

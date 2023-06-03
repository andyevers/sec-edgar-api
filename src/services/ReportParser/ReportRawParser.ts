import { CompanyFactListData } from '../../types/company-facts.type'
import { FiscalPeriod, ReportRaw, ReportType } from '../../types/report-raw.type'
import FactIterator, { IterateFactsCallbackData } from './FactIterator'

interface ReportRawParserArgs {
	factIterator?: FactIterator
}

export interface ParseReportsOptions {
	/**
	 * Instantaneous data may be filed later than the original filing date.
	 * It is flagged by "I" at the end of the frame property. defaults to true. see https://www.sec.gov/edgar/sec-api-documentation
	 * */
	mergeInstantaneousData?: boolean
	reportsToInclude?: ReportType | ReportType[] | null
}

/**
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
export default class ReportRawParser {
	private readonly factIterator: FactIterator

	constructor(args?: ReportRawParserArgs) {
		const { factIterator = new FactIterator() } = args ?? {}
		this.factIterator = factIterator
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
		this.factIterator.iterateCompanyFacts(companyFactListData, callback)
	}

	/**
	 * Returns raw reports in ascending order by report date. if date is the same, priority is filed date, frame, form
	 */
	public parseReports(
		companyFactListData: Pick<CompanyFactListData, 'facts'>,
		options?: ParseReportsOptions,
	): ReportRaw[] {
		const { reportsToInclude, mergeInstantaneousData } = options ?? {}

		// default to all report types
		const reportsToIncludeSet = reportsToInclude
			? new Set(Array.isArray(reportsToInclude) ? reportsToInclude : [reportsToInclude])
			: null

		// for getting the earliest filed date for each report
		const datesFiledByDateForm = new Map<string, string>()

		// for mapping individual properties to the report
		const reportsByKey = new Map<string, ReportRaw>()

		// fiscal period only provided for filed date, used to map to later assign for quarter end date
		const monthsFiledByFiscalPeriod = new Map<string, Set<number>>()

		// iterate individual properties AKA "facts"
		this.iterateCompanyFacts(companyFactListData, ({ factValue, propertyName, taxonomy }) => {
			const { filed, val, form, fp, end: dateReport } = factValue

			// get frame for keys and to merge instantaneous data
			const isInstantaneousData = factValue.frame?.endsWith('I') ?? false
			const isMergableFrame = (mergeInstantaneousData ?? true) && isInstantaneousData
			const frame = isMergableFrame ? factValue.frame?.substring(0, factValue.frame.length - 1) : factValue.frame

			// keys to map report and file dates
			const keyDateForm = `${dateReport}_${form}`
			const keyReport = `${frame}_${keyDateForm}`

			// set earliest date filed
			const dateFiledPrev = datesFiledByDateForm.get(keyDateForm) ?? filed
			const dateFiled = filed < dateFiledPrev ? filed : dateFiledPrev
			datesFiledByDateForm.set(keyDateForm, dateFiled)

			// if frame is undefined, the value is no longer the most recent
			if (!frame) return

			const isTTM = frame.substring(6, 8).length !== 2
			const reportType = this.getReportType({ form, taxonomy, isTTM })
			const isReportToInclude = reportsToIncludeSet?.has(reportType) ?? true

			if (!isReportToInclude) return

			// set the month filed, will be used to get the fiscal period and year
			if (reportType === 'QUARTERLY' || reportType === 'ANNUAL') {
				const monthFiled = Number(filed.substring(5, 7))
				monthsFiledByFiscalPeriod.set(fp, (monthsFiledByFiscalPeriod.get(fp) ?? new Set()).add(monthFiled))
			}

			const report: ReportRaw = reportsByKey.get(keyReport) ?? {
				dateReport,
				dateFiled,
				form,
				isTTM,
				frame,
				taxonomy,
				reportType,
				// these will be updated
				fiscalPeriod: 'FY',
				fiscalYear: 0,
			}

			reportsByKey.set(keyReport, report)

			// update earliest date filed
			report.dateFiled = dateFiled
			report[propertyName] = val
		})

		// end date is typically the month before the filed date, so subtract 1, set to 12 if 0
		const fiscalPeriodsByMonth = new Map<number, FiscalPeriod>()
		monthsFiledByFiscalPeriod.forEach((monthsSet, fiscalPeriod) => {
			monthsSet.forEach((month) => fiscalPeriodsByMonth.set(month - 1 || 12, fiscalPeriod as FiscalPeriod))
		})

		// set fiscal period and year, then merge by year_quarter, because some reports have end dates a couple days apart
		const reportsByYearPeriod = new Map<string, ReportRaw>()
		reportsByKey.forEach((report) => {
			const { dateReport, reportType } = report
			const monthReport = Number(dateReport.substring(5, 7))
			const fiscalPeriod = fiscalPeriodsByMonth.get(monthReport) ?? 'FY'

			// Q4 is always FY, so needs to be changed to Q4 (comes from fp property in fact)
			report.fiscalPeriod = reportType === 'QUARTERLY' && fiscalPeriod === 'FY' ? 'Q4' : fiscalPeriod
			report.fiscalYear = this.getFiscalYear({ dateReport, reportType, fiscalPeriod: report.fiscalPeriod })

			const keyReport = `${report.fiscalYear}_${report.fiscalPeriod}`
			const reportPrev = reportsByYearPeriod.get(keyReport)

			// if a report was already assigned to this key, merge and use the latest dateReport
			if (reportPrev) {
				const dateReport = report.dateReport > reportPrev.dateReport ? report.dateReport : reportPrev.dateReport
				reportPrev.dateReport = dateReport
				reportsByYearPeriod.set(keyReport, { ...reportPrev, ...report })
			} else {
				reportsByYearPeriod.set(keyReport, report)
			}
		})

		// return in ascending order by date report, date filed, frame, form
		return Array.from(reportsByYearPeriod.values()).sort((a, b) => {
			const keyA = `${a.fiscalYear}_${a.isTTM ? 'Q5' : a.fiscalPeriod}_${a.dateReport}_${a.dateFiled}`
			const keyB = `${b.fiscalYear}_${b.isTTM ? 'Q5' : b.fiscalPeriod}_${b.dateReport}_${b.dateFiled}`
			return keyA > keyB ? 1 : -1
		})
	}

	private getReportType(data: { form: string; taxonomy: string; isTTM: boolean }): ReportType {
		const { form, taxonomy, isTTM } = data
		if (form === '8-K') return '8K'
		else if (taxonomy === 'dei') return 'DOCUMENT_ENTITY_INFO'
		else if (isTTM) return 'ANNUAL'
		return 'QUARTERLY'
	}

	private getFiscalYear(data: { dateReport: string; fiscalPeriod: FiscalPeriod; reportType: ReportType }): number {
		const { dateReport, reportType, fiscalPeriod } = data
		const date = new Date(`${dateReport}T00:00:00`)

		const day = date.getDate()
		const month = day < 14 ? date.getMonth() || 12 : date.getMonth() + 1
		const year = date.getFullYear()

		const monthAddMap: Record<FiscalPeriod, number> = {
			Q1: 9,
			Q2: 6,
			Q3: 3,
			Q4: 0,
			FY: 0,
		}

		return month + monthAddMap[fiscalPeriod] > 12 && reportType === 'QUARTERLY' ? year + 1 : year
	}
}

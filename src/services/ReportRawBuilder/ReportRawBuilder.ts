import { CompanyFactListData, FactGroup, FactItem, FiscalPeriod, ReportRaw, SplitData } from '../../types'
import FactFiscalCalculator, { SetReportDatesParams } from './FactFiscalCalculator'
import FactGrouper from './FactGrouper'
import FactRecordBuilder from './FactRecordBuilder'
import FactSplitAdjuster from './FactSplitAdjuster'

interface BuildReportsParams {
	facts: FactItem[]
	/**
	 * for more accurate dates, add this. Otherwise, dates will be inferred
	 * using the fact periods. The filing and report dates can be found in the SubmissionList (segEdgarApi.getSubmissions)
	 */
	reportDates?: SetReportDatesParams[]
	/**
	 * Splits will be extracted from facts if not provided.
	 */
	splits?: SplitData[]
	resolvePeriodValues?: boolean
	adjustForSplits?: boolean
}

/**
 * Builds ReportRaw objects from company facts. Adjusts for splits and resolves period values.
 */
export default class ReportRawBuilder {
	private readonly factRecordBuilder = new FactRecordBuilder()

	public createFacts(companyFacts: CompanyFactListData, includeNamePrefix = false) {
		return this.factRecordBuilder.createFacts(companyFacts, includeNamePrefix)
	}

	private createFiscalCalculator(params: { facts: FactItem[] }) {
		const { facts } = params
		const fiscalCalculator = new FactFiscalCalculator()

		for (const fact of facts) {
			fiscalCalculator.add(fact)
		}

		return fiscalCalculator
	}

	public buildReports(params: BuildReportsParams) {
		const { facts, reportDates, splits: splitsProp, resolvePeriodValues = true, adjustForSplits = true } = params

		if (facts.length === 0) {
			return []
		}

		const accessionByYearQuarter = new Map<string, string>()
		reportDates?.forEach((params) => {
			const { year, quarter, accn } = params
			if (accn) accessionByYearQuarter.set(`${year}_${quarter}`, accn)
		})

		const reportsCik = Number(facts[0].cik)
		const fiscalCalculator = reportDates ? new FactFiscalCalculator() : this.createFiscalCalculator({ facts })
		reportDates?.forEach((params) => fiscalCalculator.setReportDates(params))

		const factGrouper = new FactGrouper()
		const factSplitAdjuster = new FactSplitAdjuster()
		// if splits not included in params and need to adjust, extract from facts
		const splits = adjustForSplits
			? splitsProp ?? factSplitAdjuster.getSplits({ splitFacts: factSplitAdjuster.filterSplitFacts({ facts }) })
			: splitsProp

		const { factGroupsByReportKey, maxYear, minYear } = factGrouper.buildFactGroupsByReportKey({
			facts,
			cik: reportsCik,
			fiscalCalculator,
			resolvePeriodValues,
			generateMissingGroups: false,
			splits,
		})

		return this.buildReportsFromGroups({
			factGroupsByReportKey,
			fiscalCalculator,
			splits,
			minYear,
			maxYear,
			cik: reportsCik,
		})
	}

	private createReportKey(params: { year: number; quarter: number; isAnnual: boolean }) {
		const { year, quarter, isAnnual } = params
		return `${year}_${isAnnual ? 'FY' : `Q${quarter}`}`
	}

	private createReport(params: {
		group: FactGroup
		isAnnual: boolean
		cik: number
		splitDate?: string | null
		splitRatio?: number | null
		accessionNumber: string
	}): ReportRaw {
		const { group, isAnnual, splitDate, splitRatio, cik, accessionNumber } = params
		const fiscalPeriod = isAnnual ? 'FY' : (`Q${group.quarter}` as FiscalPeriod)
		const accessionNoHyphen = accessionNumber?.replace(/-/g, '')
		const url = accessionNumber
			? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoHyphen}/${accessionNumber}.txt`
			: null

		return {
			cik: cik,
			url: url,
			dateFiled: group.reportFiled,
			dateReport: group.reportEnd,
			fiscalPeriod,
			fiscalYear: group.fiscalYear,
			splitDate: splitDate ?? null,
			splitRatio: splitRatio ?? null,
		}
	}

	private round(value: number | string) {
		const multiplier = 1_000_000
		return typeof value === 'number' ? Math.round(value * multiplier) / multiplier : value
	}

	public buildReportsFromGroups(params: {
		factGroupsByReportKey: Map<string, FactGroup[]>
		fiscalCalculator: FactFiscalCalculator
		splits?: SplitData[]
		accessionByYearQuarter?: Map<string, string>
		minYear: number
		maxYear: number
		cik: number
	}) {
		const { factGroupsByReportKey, minYear, maxYear, cik, splits, fiscalCalculator, accessionByYearQuarter } =
			params

		const splitByFiscals = new Map<string, SplitData>()
		const reportByKey = new Map<string, ReportRaw>()

		splits?.forEach((split) => {
			const { quarter, year } = fiscalCalculator.getFiscalYearQuarter({ dateStr: split.endLast })
			splitByFiscals.set(`${year}_${quarter}`, split)
		})

		factGroupsByReportKey.forEach((groups) => {
			const groupWithDates = groups.find((g) => g.reportEnd)!
			if (!groupWithDates) return

			const keyYearQuarter = `${groupWithDates.fiscalYear}_${groupWithDates.quarter}`
			const split = splitByFiscals.get(keyYearQuarter)
			const accessionNumber = accessionByYearQuarter?.get(keyYearQuarter) ?? groupWithDates.accn

			const splitDate = split?.endLast ?? null
			const splitRatio = split?.splitRatio ?? null

			const quarter = groupWithDates.quarter

			const reportPeriod = this.createReport({
				group: groupWithDates,
				accessionNumber,
				cik,
				isAnnual: false,
				splitDate,
				splitRatio,
			})

			const reportKeyPeriod = this.createReportKey({
				year: reportPeriod.fiscalYear,
				quarter,
				isAnnual: false,
			})

			for (const group of groups) {
				const value = group.valuePeriodResolved ?? group.valuePeriodFirst ?? 0
				reportPeriod[group.name] = this.round(value)
			}

			reportByKey.set(reportKeyPeriod, reportPeriod)
			if (quarter !== 4) return

			const reportAnnual = this.createReport({
				group: groupWithDates,
				accessionNumber,
				cik,
				isAnnual: true,
				splitDate,
				splitRatio,
			})

			const reportKeyAnnual = `${reportAnnual.fiscalYear}_${reportAnnual.fiscalPeriod}`

			for (const group of groups) {
				const value = group.valueTrailingResolved ?? group.valueTrailingFirst ?? 0
				reportAnnual[group.name] = this.round(value)
			}

			reportByKey.set(reportKeyAnnual, reportAnnual)
		})

		const reports: ReportRaw[] = []

		// sort reports by year and quarter
		for (let year = minYear; year <= maxYear; year++) {
			for (let quarter = 1; quarter <= 5; quarter++) {
				const isAnnual = quarter === 5
				const reportKey = this.createReportKey({ year, quarter: isAnnual ? 4 : quarter, isAnnual })
				const report = reportByKey.get(reportKey)
				if (report) {
					reports.push(report)
				}
			}
		}

		return reports
	}
}

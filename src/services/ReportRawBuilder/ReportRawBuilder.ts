import type {
	CompanyFactListData,
	FactGroup,
	FactItem,
	FilingListItemTranslated,
	FiscalPeriod,
	ReportRaw,
	SplitData,
} from '../../types'
import { FORMS_EARNINGS } from '../../util/constants'
import FactFiscalCalculator from './FactFiscalCalculator'
import FactGrouper from './FactGrouper'
import FactRecordBuilder from './FactRecordBuilder'
import FactSplitAdjuster from './FactSplitAdjuster'

export interface BuildReportsParams {
	facts: FactItem[]
	/**
	 * for more accurate dates, add this. Otherwise, dates will be inferred
	 * using the fact periods. The filing and report dates can be found in the SubmissionList (segEdgarApi.getSubmissions)
	 */
	// reportDates?: SetReportDatesParams[]
	filings?: Pick<FilingListItemTranslated, 'form' | 'reportDate' | 'filingDate' | 'accessionNumber'>[]
	/**
	 * Splits will be extracted from facts if not provided.
	 */
	splits?: SplitData[]
	resolvePeriodValues?: boolean
	adjustForSplits?: boolean
	/**
	 * For member facts (facts with segments), the separator between the fact name and the segments.
	 */
	pathSeparatorForMemberFacts?: string
}

/**
 * Builds ReportRaw objects from company facts. Adjusts for splits and resolves period values.
 */
export default class ReportRawBuilder {
	private readonly factRecordBuilder = new FactRecordBuilder()

	public createFacts(companyFacts: CompanyFactListData, includeNamePrefix = false) {
		return this.factRecordBuilder.createFacts(companyFacts, includeNamePrefix)
	}

	private getFactKey(fact: FactItem, pathSeparator: string) {
		const suffix = fact.segments
			?.map(({ dimension, value }) => `${dimension}${pathSeparator}${value}`)
			.join(pathSeparator)

		return suffix ? `${fact.name}${pathSeparator}${suffix}` : fact.name
	}

	public buildReports(params: BuildReportsParams) {
		const {
			facts: factsProp,
			filings,
			splits: splitsProp,
			resolvePeriodValues = true,
			adjustForSplits = true,
			pathSeparatorForMemberFacts = '>',
		} = params

		// Rename member facts to prevent overwriting parent facts.
		const facts = factsProp.map((fact) => {
			const factKey = this.getFactKey(fact, pathSeparatorForMemberFacts)
			return { ...fact, name: factKey }
		})

		if (facts.length === 0) {
			return []
		}

		const reportsCik = Number(facts[0].cik)
		const fiscalCalculator = new FactFiscalCalculator({
			filings: filings?.filter((f) => FORMS_EARNINGS.includes(f.form)),
			facts,
		})

		const accessionByYearQuarter = new Map<string, string>()
		filings?.forEach((f) => {
			const { year, quarter } = fiscalCalculator.getFiscalYearQuarter({ dateStr: f.reportDate })
			accessionByYearQuarter.set(f.accessionNumber, `${year}_${quarter}`)
		})

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
			const groupWithDates = groups.find((g) => g.reportEnd)
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

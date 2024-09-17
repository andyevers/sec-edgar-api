import { CompanyFactListData, FiscalPeriod, ReportRaw } from '../../types'
import FactFiscalCalculator, { SetReportDatesParams } from './FactFiscalCalculator'
import FactPeriodResolver from './FactPeriodResolver'
import FactRecordBuilder from './FactRecordBuilder'
import FactSplitAdjuster from './FactSplitAdjuster'

export interface FactItem {
	cik: number | string
	end: string
	filed: string
	name: string
	unit: string
	value: number | string
	start?: string
	hasSegments?: boolean
	accn?: string
	form?: string
	fp?: string
	frame?: string
	fy?: number
	/** For XBRL reports only */
	segments?: { value: string; dimension: string }[]
	uuid?: string
}

export interface FactItemWithFiscals extends FactItem {
	fiscalPeriod: FiscalPeriod
	year: number
}

export default class ReportBuilder {
	private readonly factRecordBuilder = new FactRecordBuilder()

	public createFacts(companyFacts: CompanyFactListData) {
		return this.factRecordBuilder.createFacts(companyFacts)
	}

	public buildReports(params: { facts: FactItem[]; reportDates?: SetReportDatesParams[] }) {
		const { facts, reportDates } = params

		if (facts.length === 0) {
			return []
		}

		const accessionByYearQuarter = new Map<string, string>()
		reportDates?.forEach((params) => {
			const { year, quarter, accn } = params
			if (accn) accessionByYearQuarter.set(`${year}_${quarter}`, accn)
		})

		const reportsCik = Number(facts[0].cik)

		const factFiscalCalculator = new FactFiscalCalculator()
		const factPeriodResolver = new FactPeriodResolver({ cik: reportsCik })
		const factSplitAdjuster = new FactSplitAdjuster()

		facts.forEach((fact) => factFiscalCalculator.add(fact))
		reportDates?.forEach((params) => factFiscalCalculator.setReportDates(params))

		const unitByPropertyName = new Map<string, string>()
		const splitDateDataByKey = new Map<string, { end: string; quarter: number }>()

		let minYear = Infinity
		let maxYear = -Infinity

		const countByAccnByYearQuarter = new Map<string, Map<string, number>>()

		for (const fact of facts) {
			const { end, name, unit, segments, start, value, cik, form, filed, accn } = fact

			if (Number(fact.cik) !== Number(reportsCik)) {
				throw new Error(`All facts must have the same cik ${reportsCik} !== ${Number(cik)}`)
			}

			const segmentValue = segments?.map((seg) => `${seg.dimension}_${seg.value}`).join('&')
			const propertyName = name.split(':').pop() ?? ''
			const propertyNameWithSegment = propertyName + (segmentValue ? `_${segmentValue}` : '')

			const { quarter, year } = factFiscalCalculator.getFiscalYearQuarter({ dateStr: end })

			if (year < minYear) minYear = year
			if (year > maxYear) maxYear = year

			const splitKey = `${year}_${value}`
			const isSplit = factSplitAdjuster.isSplitProperty(propertyName)

			unitByPropertyName.set(propertyNameWithSegment, unit)

			if (isSplit && new Date(end) > new Date(splitDateDataByKey.get(splitKey)?.end ?? 0)) {
				splitDateDataByKey.set(splitKey, { end, quarter })
			}

			const accnKey = `${year}_${quarter}`
			const accnGiven = accessionByYearQuarter.get(accnKey)

			const filedDistance = Math.abs(new Date(filed).getTime() - new Date(end ?? 0).getTime()) / 86_400_000
			const isFiledRecent = filedDistance < 60

			if (!accnGiven && isFiledRecent && accn && (!form || form === '10-K' || form === '10-Q')) {
				const countByAccn = countByAccnByYearQuarter.get(accnKey) ?? new Map()
				countByAccn.set(accn, (countByAccn.get(accn) ?? 0) + 1)
				countByAccnByYearQuarter.set(accnKey, countByAccn)
			}

			const dates = factFiscalCalculator.getDatesByYearQuarter({ quarter, year })

			factPeriodResolver.add({
				year,
				start,
				end,
				name: propertyNameWithSegment,
				quarter,
				value,
				dateFiled: dates?.filed ?? '',
				dateReport: dates?.end ?? '',
			})
		}

		countByAccnByYearQuarter.forEach((countByAccn, yearQuarter) => {
			if (accessionByYearQuarter.has(yearQuarter)) return
			let maxCount = 0
			let accessionNumber = ''
			countByAccn.forEach((count, accn) => {
				if (count > maxCount) {
					maxCount = count
					accessionNumber = accn
				}
			})
			accessionByYearQuarter.set(yearQuarter, accessionNumber)
		})

		minYear = Number.isFinite(minYear) ? minYear : new Date().getFullYear()
		maxYear = Number.isFinite(maxYear) ? maxYear : new Date().getFullYear()

		const reportsByKey = new Map<string, ReportRaw>()

		// resolves quarterly and annual properties and creates reports
		factPeriodResolver.forEach((data) => {
			const { fiscalPeriod, propertyName, value, year } = data
			const key = `${year}_${fiscalPeriod}`

			const quarter = fiscalPeriod === 'FY' ? 4 : Number(fiscalPeriod[1])
			const dates = factFiscalCalculator.getDatesByYearQuarter({ quarter, year })

			const { filed, end } = dates ?? { filed: '', end: '' }
			const accessionNumber = accessionByYearQuarter.get(`${year}_${quarter}`)
			const accessionNoHyphen = accessionNumber?.replace(/-/g, '')
			const url = accessionNumber
				? `https://www.sec.gov/Archives/edgar/data/${reportsCik}/${accessionNoHyphen}/${accessionNumber}.txt`
				: null

			if (!reportsByKey.has(key)) {
				reportsByKey.set(key, {
					cik: reportsCik,
					url,
					dateFiled: filed,
					dateReport: end,
					fiscalPeriod,
					fiscalYear: year,
					splitDate: null,
					splitRatio: null,
				})
			}

			// add facts to adjust for splits
			factSplitAdjuster.add({
				end,
				filed,
				fiscalPeriod,
				name: propertyName,
				unit: unitByPropertyName.get(propertyName) ?? '',
				year,
				value: Number(value),
				accn: accessionNumber ?? '',
			})

			const report = reportsByKey.get(key)!
			report[propertyName] = value
		})

		// iterate through facts adjustable for splits and assign values to reports
		factSplitAdjuster.forEach((data) => {
			const { year, fiscalPeriod, propertyName, value } = data
			const key = `${year}_${fiscalPeriod}`
			const report = reportsByKey.get(key)

			if (!report) return
			report[propertyName] = Math.round(value * 10000) / 10000
		})

		// add split dates and values to reports
		factSplitAdjuster.getSplitsAsc().forEach((split) => {
			const { quarter, year } = factFiscalCalculator.getFiscalYearQuarter({ dateStr: split.end })

			const keySplit = `${year}_${split.value}`

			const splitDateData = splitDateDataByKey.get(keySplit) ?? { end: null, quarter: null }
			const splitDate = splitDateData.end ?? split.filed
			const splitQuarter = splitDateData.quarter ?? quarter

			const fiscalPeriod = `Q${splitQuarter}`
			const keyReport = `${year}_${fiscalPeriod}`

			const report = reportsByKey.get(keyReport)
			const reportAnnual = splitQuarter === 4 ? reportsByKey.get(`${year}_FY`) ?? null : null

			if (report) {
				report.splitRatio = split.value
				report.splitDate = splitDate
			}

			// also assign to annual for Q4
			if (reportAnnual) {
				reportAnnual.splitRatio = split.value
				reportAnnual.splitDate = splitDate
			}
		})

		// sort reports ASC by year and quarter
		const reportsSorted: ReportRaw[] = []
		for (let year = minYear; year <= maxYear; year++) {
			for (let i = 0; i < 5; i++) {
				const fiscalPeriod = i === 4 ? 'FY' : `Q${i + 1}`
				const key = `${year}_${fiscalPeriod}`
				const report = reportsByKey.get(key)
				if (report && report.dateReport) {
					reportsSorted.push(report)
				}
			}
		}

		return reportsSorted
	}
}

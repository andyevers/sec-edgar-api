import { FiscalPeriod } from '../../types/report-raw.type'
import ReportRawResolvable from './ReportRawResolvable'

/**
 * Resolves quarterly and annual values for a property. This is because filers provide total values for the
 * current fiscal year, rather than values for the individual quarters
 * ex: Net income for Q2 will give 6 months revenue, not 3 month.
 */
export default class FactPeriodResolver {
	/** Values for each quarter [numQ1, numQ2, numQ3, numQ4] */
	private readonly valueByQuarterByPropertyByYear = new Map<number, Map<string, Map<number, number>>>()

	/** Same as by quarter but string values */
	private readonly valueByQuarterByPropertyByYearString = new Map<number, Map<string, Map<number, string>>>()

	/** Value sums (each includes sum of previous quarter). last el used for annual report. [sumQ1, sumQ2, sumQ3, sumFY] */
	private readonly sumByQuarterByPropertyByYear = new Map<number, Map<string, Map<number, number>>>()

	/** Which properties have a range that need to be resolved to get quarterly value */
	private readonly propertiesResolvableByYear = new Map<number, Set<string>>()

	/** all properties present for each year */
	private readonly propertiesByYear = new Map<number, Set<string>>()

	/** prevent values from being added multiple times */
	private readonly resolvedValues = new Set<string>()

	private readonly cik: number

	constructor(args: { cik: number }) {
		const { cik } = args
		this.cik = cik
	}

	private getOrSetBucketArr<T extends string | number>(
		map: Map<number, Map<string, Map<number, T>>>,
		year: number,
		propertyName: string,
	): Map<number, T> {
		const propertyMap = map.get(year) ?? map.set(year, new Map()).get(year)!
		return propertyMap.get(propertyName) ?? propertyMap.set(propertyName, new Map()).get(propertyName)!
	}

	private addPropertyByYear(bucket: Map<number, Set<string>>, year: number, propertyName: string) {
		const properties = bucket.get(year) ?? bucket.set(year, new Set()).get(year)!
		properties.add(propertyName)
	}

	public resolveValues(propertyName: string, year: number) {
		const keyResolved = `${year}_${propertyName}`
		const isResolved = this.resolvedValues.has(keyResolved)
		const isResolvable = Boolean(this.propertiesResolvableByYear.get(year)?.has(propertyName))

		if (!isResolvable || isResolved) return

		const { bucketQuarter, bucketSum } = this.getPropertyBuckets(year, propertyName)

		if (bucketQuarter.size === 4 && bucketSum.has(3)) return

		for (let i = 0; i < 4; i++) {
			const quarterValue = bucketQuarter.get(i)
			const reportKey = `${year}_${i + 1}`

			const unresolvedReport = this.unresolvedReports.get(reportKey)
			const unresolvedReportPrev = this.unresolvedReports.get(`${year}_${i}`)

			const sumValue = unresolvedReport?.getNumber(propertyName) ?? 0
			const prevSum = unresolvedReportPrev?.getNumber(propertyName) ?? 0

			if (quarterValue === undefined) {
				const bucketQuarter = this.getOrSetBucketArr(this.valueByQuarterByPropertyByYear, year, propertyName)
				bucketQuarter.set(i, (Number(sumValue) || 0) - (Number(prevSum) || 0))
			}

			if (quarterValue !== undefined && sumValue === undefined) {
				const bucketSum = this.getOrSetBucketArr(this.sumByQuarterByPropertyByYear, year, propertyName)
				bucketSum.set(i, quarterValue + prevSum)
			}
		}

		this.resolvedValues.add(keyResolved)
	}

	public get(propertyName: string, year: number, fiscalPeriod: FiscalPeriod) {
		this.resolveValues(propertyName, year)
		const index = { Q1: 0, Q2: 1, Q3: 2, Q4: 3, FY: 3 }[fiscalPeriod] ?? 4
		const isAnnual = fiscalPeriod === 'FY'
		const bucket = isAnnual
			? this.sumByQuarterByPropertyByYear.get(year)
			: this.valueByQuarterByPropertyByYear.get(year)

		return bucket?.get(propertyName)?.get(index)
	}

	private getPropertyBuckets(year: number, propertyName: string) {
		const isInstant = !this.propertiesResolvableByYear.get(year)?.has(propertyName)
		const bucketQuarter = this.valueByQuarterByPropertyByYear.get(year)?.get(propertyName) ?? new Map()
		const bucketSum = isInstant
			? bucketQuarter
			: this.sumByQuarterByPropertyByYear.get(year)?.get(propertyName) ?? new Map()
		const bucketString = this.valueByQuarterByPropertyByYearString.get(year)?.get(propertyName) ?? new Map()

		return { bucketQuarter, bucketSum, bucketString }
	}

	public getPeriod(params: { start?: string; end: string }) {
		const { start, end } = params

		if (!start || start === end) return 0
		const differenceMS = new Date(end).getTime() - new Date(start).getTime()
		const differenceDays = differenceMS / 86_400_000

		if (differenceDays < 135) return 3
		if (differenceDays < 225) return 6
		if (differenceDays < 315) return 9
		return 12
	}

	private getOrSetReport(params: { year: number; quarter: number }) {
		const { year, quarter } = params
		const key = `${year}_${quarter}`

		const report =
			this.unresolvedReports.get(key) ??
			new ReportRawResolvable({
				cik: this.cik,
				fiscalYear: year,
				fiscalPeriod: quarter === 4 ? 'FY' : (`Q${quarter}` as FiscalPeriod),
				dateReport: '',
				dateFiled: '',
				url: null,
				splitDate: null,
				splitRatio: null,
			})

		if (!this.unresolvedReports.has(key)) {
			this.unresolvedReports.set(key, report)
		}

		return report
	}

	public isFiledRecent(params: { end: string; filed: string }) {
		const { end, filed } = params
		const DAY_60_MS = 5_184_000_000
		return new Date(filed).getTime() - new Date(end).getTime() < DAY_60_MS
	}

	public add(params: {
		year: number
		quarter: number
		start?: string
		end: string
		value: number | string
		name: string
		filed: string
	}) {
		const { year, value, name: propertyName, quarter, start, end, filed } = params

		const period = this.getPeriod({ start, end })

		this.addPropertyByYear(this.propertiesByYear, year, propertyName)

		const bucketIndex = quarter - 1
		if (typeof value === 'string') {
			const bucket = this.getOrSetBucketArr(this.valueByQuarterByPropertyByYearString, year, propertyName)

			if (!bucket.has(bucketIndex) || this.isFiledRecent({ end, filed })) {
				bucket.set(bucketIndex, value)
			}
			return
		}

		if (period === 0) {
			const bucket = this.getOrSetBucketArr(this.valueByQuarterByPropertyByYear, year, propertyName)
			const bucketSum = this.getOrSetBucketArr(this.sumByQuarterByPropertyByYear, year, propertyName)

			if (!bucket.has(bucketIndex) || this.isFiledRecent({ end, filed })) {
				bucket.set(bucketIndex, value)
				bucketSum.set(bucketIndex, value)
			}
			return
		}

		if (period === 3) {
			const bucket = this.getOrSetBucketArr(this.valueByQuarterByPropertyByYear, year, propertyName)

			if (!bucket.has(bucketIndex) || this.isFiledRecent({ end, filed })) {
				bucket.set(bucketIndex, value)
			}
		}

		if (quarter === 1 || period > 3) {
			const bucket = this.getOrSetBucketArr(this.sumByQuarterByPropertyByYear, year, propertyName)

			if (!bucket.has(bucketIndex) || this.isFiledRecent({ end, filed })) {
				bucket.set(bucketIndex, value)
			}
		}

		this.addPropertyByYear(this.propertiesResolvableByYear, year, propertyName)
	}

	private readonly unresolvedReports = new Map<string, ReportRawResolvable>()

	private buildUnresolvedReports() {
		this.propertiesByYear.forEach((properties, year) => {
			properties.forEach((propertyName) => {
				for (let i = 0; i < 4; i++) {
					const bucketSum = this.sumByQuarterByPropertyByYear.get(year)?.get(propertyName)

					const bucketQuarter = this.getOrSetBucketArr(
						this.valueByQuarterByPropertyByYear,
						year,
						propertyName,
					)

					if (bucketSum && !bucketSum.has(i)) {
						let prevSum = 0
						let quarterSum = 0
						for (let j = 0; j < i; j++) {
							prevSum = quarterSum
							quarterSum = bucketSum.get(j) ?? quarterSum
						}

						bucketSum.set(i, quarterSum)
						bucketQuarter.set(i, quarterSum - prevSum)
					}

					const value = bucketSum?.get(i)

					if (value === undefined) continue

					const report = this.getOrSetReport({ year, quarter: i + 1 })
					report.report[propertyName] = value
				}
			})
		})
	}

	public forEach(
		callback: (params: {
			year: number
			fiscalPeriod: FiscalPeriod
			propertyName: string
			value: number | string
			valueQuarter: number
			valueTrailing: number
			quarter: number
		}) => void,
	) {
		this.buildUnresolvedReports()

		this.propertiesByYear.forEach((properties, year) => {
			properties.forEach((propertyName) => {
				this.resolveValues(propertyName, year)

				for (let i = 0; i < 4; i++) {
					const isAnnual = i === 4
					const { bucketQuarter, bucketSum, bucketString } = this.getPropertyBuckets(year, propertyName)
					const valueQuarter = bucketQuarter.get(i) ?? bucketString.get(i)
					const valueTrailing = bucketSum.get(i)
					const value = (isAnnual ? bucketSum.get(3) : bucketQuarter.get(i)) ?? bucketString.get(i)
					const quarter = i + 1
					callback({
						year,
						fiscalPeriod: `Q${quarter}` as FiscalPeriod,
						propertyName,
						value,
						quarter,
						valueQuarter,
						valueTrailing,
					})
				}
			})
		})
	}
}

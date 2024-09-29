import { FiscalPeriod, ReportRaw } from '../../types/report-raw.type'

type TrippleNestedMap<T> = Map<number, Map<string, Map<number, T>>>

/**
 * Resolves quarterly and annual values for a property. This is because filers provide total values for the
 * current fiscal year, rather than values for the individual quarters
 * ex: Net income for Q2 will give 6 months revenue, not 3 month.
 */
export default class FactPeriodResolver {
	/** Values for each quarter [numQ1, numQ2, numQ3, numQ4] */
	private readonly valueByQuarterByPropertyByYear: TrippleNestedMap<number> = new Map()

	/** Same as by quarter but string values */
	private readonly valueByQuarterByPropertyByYearString: TrippleNestedMap<string> = new Map()

	/** Value sums (each includes sum of previous quarter). last el used for annual report. [sumQ1, sumQ2, sumQ3, sumFY] */
	private readonly sumByQuarterByPropertyByYear: TrippleNestedMap<number> = new Map()

	/** Which properties have a range that need to be resolved to get quarterly value */
	private readonly propertiesResolvableByYear = new Map<number, Set<string>>()

	/** all properties present for each year */
	private readonly propertiesByYear = new Map<number, Set<string>>()

	/** prevent values from being added multiple times */
	private readonly resolvedValues = new Set<string>()

	private readonly unresolvedReports = new Map<string, ReportRaw>()

	private readonly cik: number
	private readonly preferOriginalFilingValues: boolean

	constructor(args: { cik: number; preferOriginalFilingValues?: boolean }) {
		const { cik, preferOriginalFilingValues = false } = args
		this.cik = cik
		this.preferOriginalFilingValues = preferOriginalFilingValues
	}

	/**
	 * Some properties have a start and end that represent a period average, rather than a period total.
	 * These properties should be treated as instantaneous properties, meaning
	 * the value for Q4 and FY should be the same.
	 *
	 * I believe the only properties like this are share related:
	 * us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding and us-gaap:WeightedAverageNumberOfSharesOutstandingBasic.
	 * May need to update this in the future if there are more
	 */
	public static isAverageShares(params: { propertyName: string }) {
		const { propertyName } = params

		return (
			propertyName.includes('Average') &&
			(propertyName.includes('SharesOutstanding') || propertyName.includes('SharesIssued'))
		)
	}

	private isAverageShares(params: { propertyName: string }) {
		return FactPeriodResolver.isAverageShares(params)
	}

	/**
	 * Used to check if this should potentially overwrite a value that has already been set.
	 */
	private isPreferredValue(params: {
		bucket: Map<number, number | string>
		bucketIndex: number
		end: string
		filed: string
	}) {
		const { bucket, end, filed, bucketIndex } = params
		return !bucket.has(bucketIndex) || this.preferOriginalFilingValues || !this.isOriginalFiling({ end, filed })
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

			const sumValue = unresolvedReport?.[propertyName] ?? 0
			const prevSum = unresolvedReportPrev?.[propertyName] ?? 0

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

	/**
	 * 0, 3, 6, 9, or 12 month period. 0 is instantaneous data that doesn't have a time period, (ex: assets)
	 * other facts have values that are for a period of time. (like revenue over the last 6 months).
	 *
	 * Use periods 0 and 3 for quarterly reports and 0 and 12 for annual reports.
	 */
	public static getPeriod(params: { start?: string; end: string }) {
		const { start, end } = params

		if (!start || start === end) return 0
		const differenceMS = new Date(end).getTime() - new Date(start).getTime()
		const differenceDays = differenceMS / 86_400_000

		if (differenceDays < 135) return 3
		if (differenceDays < 225) return 6
		if (differenceDays < 315) return 9
		return 12
	}

	public getPeriod(params: { start?: string; end: string }) {
		return FactPeriodResolver.getPeriod(params)
	}

	private getOrSetReport(params: { year: number; quarter: number }) {
		const { year, quarter } = params
		const key = `${year}_${quarter}`

		const report = this.unresolvedReports.get(key) ?? {
			cik: this.cik,
			fiscalYear: year,
			fiscalPeriod: quarter === 4 ? 'FY' : (`Q${quarter}` as FiscalPeriod),
			dateReport: '',
			dateFiled: '',
			url: null,
			splitDate: null,
			splitRatio: null,
		}

		if (!this.unresolvedReports.has(key)) {
			this.unresolvedReports.set(key, report)
		}

		return report
	}

	/**
	 * True if the filed date is within 60 days of the end date. This indicates that it is likely
	 * the original filing of the fact because filers are required to submit within 45 days of the
	 * period end, and subsequent reports are filed 90 days apart.
	 */
	public isOriginalFiling(params: { end: string; filed: string }) {
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

		const bucketIndex = quarter - 1
		const period = this.isAverageShares({ propertyName }) ? 0 : this.getPeriod({ start, end })

		this.addPropertyByYear(this.propertiesByYear, year, propertyName)

		if (typeof value === 'string') {
			const bucket = this.getOrSetBucketArr(this.valueByQuarterByPropertyByYearString, year, propertyName)

			if (this.isPreferredValue({ bucket, bucketIndex, end, filed })) {
				bucket.set(bucketIndex, value)
			}
			return
		}

		if (period === 0) {
			const bucket = this.getOrSetBucketArr(this.valueByQuarterByPropertyByYear, year, propertyName)
			const bucketSum = this.getOrSetBucketArr(this.sumByQuarterByPropertyByYear, year, propertyName)

			if (this.isPreferredValue({ bucket, bucketIndex, end, filed })) {
				bucket.set(bucketIndex, value)
				bucketSum.set(bucketIndex, value)
			}
			return
		}

		if (period === 3) {
			const bucket = this.getOrSetBucketArr(this.valueByQuarterByPropertyByYear, year, propertyName)

			if (this.isPreferredValue({ bucket, bucketIndex, end, filed })) {
				bucket.set(bucketIndex, value)
			}
		}

		if (quarter === 1 || period > 3) {
			const bucket = this.getOrSetBucketArr(this.sumByQuarterByPropertyByYear, year, propertyName)

			if (this.isPreferredValue({ bucket, bucketIndex, end, filed })) {
				bucket.set(bucketIndex, value)
			}
		}

		this.addPropertyByYear(this.propertiesResolvableByYear, year, propertyName)
	}

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
					report[propertyName] = value
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

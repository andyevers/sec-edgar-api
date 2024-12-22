import type { FactItem, FilingListItemTranslated } from '../../types'

export interface SetReportDatesParams {
	year: number
	quarter: number
	end: string
	filed: string
	isAnnual: boolean
	accn: string
}

/**
 * Gets the fiscal period for a given date. does this by checking when the FY end periods are,
 * Then measures the offset from the end date to the next/previous fiscal year end.
 */
export default class FactFiscalCalculator {
	private readonly endDateByYear = new Map<number, Date>()

	private readonly fiscalsByEndDate = new Map<string, { year: number; quarter: number }>()
	private readonly datesByFiscals = new Map<string, { filed: string; end: string }>()

	/// these get cleared after resolve
	private readonly endDateCountMap = new Map<string, number>()
	private readonly filedDateCountByEndDate = new Map<string, Map<string, number>>()

	private didResolve = false

	constructor(params?: {
		facts?: Pick<FactItem, 'end' | 'filed'>[]
		filings?: Pick<FilingListItemTranslated, 'form' | 'reportDate' | 'filingDate' | 'accessionNumber'>[]
	}) {
		const { facts = [], filings = [] } = params ?? {}
		if (filings.length > 0) {
			this.useFilingsForDates({ filings })
		}

		facts.forEach((fact) => this.add(fact))
	}

	public useFilingsForDates(params: {
		filings: Pick<FilingListItemTranslated, 'form' | 'reportDate' | 'filingDate' | 'accessionNumber'>[]
	}) {
		const { filings } = params

		const endDateByYear = new Map<number, Date>()

		filings.forEach(({ reportDate, form }) => {
			if (form === '10-K' || form === '20-F') {
				endDateByYear.set(Number(reportDate.substring(0, 4)), new Date(reportDate))
			}
		})

		filings.forEach((filing) => {
			if (filing.form === '10-K' || filing.form === '10-Q' || filing.form === '20-F' || filing.form === '40-F') {
				const { quarter, year } = this.getFiscalYearQuarter({
					dateStr: filing.reportDate,
					endDateByYear,
				})

				this.setReportDates({
					accn: filing.accessionNumber,
					end: filing.reportDate,
					filed: filing.filingDate,
					isAnnual: filing.form === '10-K' || filing.form === '20-F',
					quarter,
					year,
				})
			}
		})
	}

	public add(fact: { end: string; filed: string }) {
		const { end, filed } = fact

		if (this.didResolve) {
			throw new Error('Cannot add fact after resolving')
		}

		if (this.isAnnualReportFact(fact)) {
			this.addAnnualReportDate(fact.end)
		}

		this.endDateCountMap.set(end, (this.endDateCountMap.get(end) ?? 0) + 1)

		// don't record filed dates for restated facts
		if (this.getDaysBefore(filed, end) < 60) {
			const bucket =
				this.filedDateCountByEndDate.get(end) ?? this.filedDateCountByEndDate.set(end, new Map()).get(end)!
			bucket.set(filed, (bucket.get(filed) ?? 0) + 1)
		}
	}

	private getDaysBefore(dateStrAfter: string, dateStrBefore: string) {
		const dateAfter = new Date(dateStrAfter)
		const dateBefore = new Date(dateStrBefore)

		const dayMS = 86_400_000
		const differenceMS = dateAfter.getTime() - dateBefore.getTime()
		return differenceMS / dayMS
	}

	public setReportDates(params: SetReportDatesParams) {
		const { year, quarter, end, filed, isAnnual } = params
		const key = `${year}_${quarter}`
		if (!this.datesByFiscals.has(key)) {
			if (year.toString().length !== 4) return
			this.datesByFiscals.set(key, { filed, end })
		}

		const dates = this.datesByFiscals.get(key)!
		dates.filed = filed
		dates.end = end

		this.filedDateCountByEndDate.set(end, new Map([[filed, Infinity]]))
		this.endDateCountMap.set(end, Infinity)

		if (isAnnual) {
			this.endDateByYear.set(Number(end.split('-', 1)[0]), new Date(end))
		}
	}

	public addAnnualReportDate(reportDate: string) {
		const year = Number(reportDate.split('-', 1)[0])
		const dateEnd = new Date(reportDate)
		this.endDateByYear.set(year, dateEnd)
	}

	private isAnnualReportFact(params: {
		end: string
		start?: string
		filed: string
		period?: number
		frame?: string
	}) {
		const { end, start, filed, period, frame } = params
		if (frame) {
			// FY frames will look like CY2023 vs CY2023Q2 or CY2023Q2I
			return frame.length === 6
		}

		if (period !== undefined) return period === 12

		// TODO: This was breaking for TSM. they file reports way late.
		if (!start || this.getDaysBefore(end, start) < 315) return false

		return this.getDaysBefore(filed, end) < 60
		// return start && this.getDaysBefore(end, start) < 315
	}

	private resolve() {
		this.endDateCountMap.forEach((count, date) => {
			const { quarter, year } = this.getFiscalYearQuarter({ dateStr: date })
			if (year.toString().length !== 4) return
			const key = `${year}_${quarter}`
			if (!this.datesByFiscals.has(key)) {
				this.datesByFiscals.set(key, { filed: '', end: '' })
			}

			const dateMap = this.datesByFiscals.get(key)!
			const countPrevDate = this.endDateCountMap.get(dateMap.end) ?? 0

			if (count >= countPrevDate) {
				dateMap.end = date
			}
		})

		// set to the most commonly used filed date for each end date
		this.filedDateCountByEndDate.forEach((countByFiledDate, endDate) => {
			let maxCount = 0
			let filedDate = ''

			countByFiledDate.forEach((count, filed) => {
				if (count > maxCount) {
					maxCount = count
					filedDate = filed
				}
			})

			const { quarter, year } = this.getFiscalYearQuarter({ dateStr: endDate })
			const key = `${year}_${quarter}`

			if (!this.datesByFiscals.has(key)) {
				if (year.toString().length !== 4) return
				this.datesByFiscals.set(key, { filed: '', end: '' })
			}

			const dateMap = this.datesByFiscals.get(key)!
			dateMap.filed = filedDate
		})

		// some reports are missing filed dates, this guesses dates based on other years.
		const monthDayByQuarter = new Map<number, { filedMonthDay: string; endMonthDay: string }>()

		// find dates for each quarter to fill in missing.
		let foundCount = 0
		for (const [key, dates] of Array.from(this.datesByFiscals.entries())) {
			const quarter = Number(key.split('_')[1])
			const bucket = monthDayByQuarter.get(quarter) ?? { filedMonthDay: '', endMonthDay: '' }
			monthDayByQuarter.set(quarter, bucket)

			if (dates.filed && !bucket.filedMonthDay) {
				bucket.filedMonthDay = dates.filed.substring(5)
				foundCount++
			}

			if (dates.end && !bucket.endMonthDay) {
				bucket.endMonthDay = dates.end.substring(5)
				foundCount++
			}

			if (foundCount === 8) {
				break
			}
		}

		// if date falls on a weekend, move it to the nearest weekday
		const ensureNoWeekends = (dateStr: string) => {
			const date = new Date(dateStr)
			if (date.getDay() === 6) date.setDate(date.getDate() - 1)
			if (date.getDay() === 0) date.setDate(date.getDate() + 1)
			return date.toISOString().split('T')[0]
		}

		// fill in missing dates
		this.datesByFiscals.forEach((dates, key) => {
			const quarter = Number(key.split('_')[1])
			const datesFound = monthDayByQuarter.get(quarter) ?? { filedMonthDay: '', endMonthDay: '' }

			// if filing month comes after report month, it's the same year, otherwise it's the next year
			if (!dates.filed && dates.end && datesFound.filedMonthDay) {
				const [yearEnd, month, day] = dates.end.split('-')
				const yearFiled = datesFound.filedMonthDay >= `${month}-${day}` ? yearEnd : Number(yearEnd) + 1
				dates.filed = ensureNoWeekends(`${yearFiled}-${datesFound.filedMonthDay}`)
			}
			if (dates.filed && !dates.end && datesFound.endMonthDay) {
				const [yearFiled, month, day] = dates.filed.split('-')
				const yearEnd = `${month}-${day}` >= datesFound.endMonthDay ? yearFiled : Number(yearFiled) - 1
				dates.end = ensureNoWeekends(`${yearEnd}-${datesFound.endMonthDay}`)
			}
		})

		this.endDateCountMap.clear()
		this.filedDateCountByEndDate.clear()
		this.didResolve = true
	}

	public getDatesByYearQuarter(params: { year: number; quarter: number }) {
		if (!this.didResolve) this.resolve()
		this.didResolve = true
		return this.datesByFiscals.get(`${params.year}_${params.quarter}`) ?? null
	}

	public getFiscalYearQuarter(params: { dateStr: string; endDateByYear?: Map<number, Date> }) {
		const { dateStr, endDateByYear = this.endDateByYear } = params

		if (this.fiscalsByEndDate.has(dateStr)) {
			return this.fiscalsByEndDate.get(dateStr)!
		}

		const fiscals = FactFiscalCalculator.getFiscalYearQuarter({ dateStr, endDateByYear })
		this.fiscalsByEndDate.set(dateStr, fiscals)
		return fiscals
	}

	public static getFiscalYearQuarter(params: { dateStr: string; endDateByYear: Map<number, Date> }) {
		const { dateStr, endDateByYear } = params

		if (endDateByYear.size === 0) {
			throw new Error('No annual report dates provided')
		}

		const getYearEndDate = (year: number) => {
			const YEAR_MS = 31536000000
			const date = endDateByYear.get(year)
			const datePrev = endDateByYear.get(year - 1)
			const dateNext = endDateByYear.get(year + 1)

			if (date) return date
			if (datePrev) return new Date(datePrev.getTime() + YEAR_MS)
			if (dateNext) return new Date(dateNext.getTime() - YEAR_MS)

			const prevKnownYear = Math.max(...Array.from(endDateByYear.keys()))
			const prevKnownDate = endDateByYear.get(prevKnownYear)
			const years = (year - prevKnownYear) * YEAR_MS

			return new Date((prevKnownDate?.getTime() ?? 0) + years)
		}

		const getDaysBefore = (dateA: Date, dateB: Date) => {
			return (dateB.getTime() - dateA.getTime()) / 86400000
		}

		const getFiscalQuarter = (daysBeforeYearEnd: number) => {
			let quarter = 1
			if (daysBeforeYearEnd < 45) {
				quarter = 4
			} else if (daysBeforeYearEnd < 135) {
				quarter = 3
			} else if (daysBeforeYearEnd < 225) {
				quarter = 2
			}
			return quarter
		}

		const yearQuarter = Number(dateStr.split('-')[0])
		const dateQuarter = new Date(dateStr)

		const yearEndDate = getYearEndDate(yearQuarter)
		const daysBefore = getDaysBefore(dateQuarter, yearEndDate)

		const isCurFiscalYear = daysBefore > -30

		const fiscalYear = isCurFiscalYear ? yearQuarter : yearQuarter + 1
		const fiscalYearEndDate = isCurFiscalYear ? yearEndDate : getYearEndDate(fiscalYear)
		const daysFromYearEnd = (fiscalYearEndDate.getTime() - dateQuarter.getTime()) / 86400000
		const quarter = getFiscalQuarter(daysFromYearEnd)

		return { quarter, year: fiscalYear }
	}
}

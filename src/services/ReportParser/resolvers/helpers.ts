import { ReportTranslated } from '../../../types'

interface SplitValueBetweenReportsParams {
	key: keyof ReportTranslated
	value: number
	reports: ReportTranslated[]
	roundToPlaces: number
}

export type ExcludeNulls<T> = {
	[K in keyof T]: Exclude<T[K], null>
}

export function getSingleNullKey<T>(obj: T): keyof T | null {
	let singleNullKey: keyof T | null = null
	for (const key in obj) {
		if (obj[key as keyof typeof obj] !== null) continue
		if (singleNullKey === null) singleNullKey = key
		else return null
	}
	return singleNullKey
}

export function round(num: number, places: number) {
	return Math.round(num / places) * places
}

/**
 * returns the number of places the number is rounded to
 */
export function getRoundToPlaces(num: number) {
	if (num.toString().endsWith('000000')) return 1_000_000
	if (num.toString().endsWith('000')) return 1_000
	return 1
}

/**
 * distributes a value between each report evenly, and rounds to the nearest roundToPlaces. gives remainder to last report
 */
export function splitValueBetweenReports(params: SplitValueBetweenReportsParams) {
	const { key, value, roundToPlaces } = params
	const reports = params.reports as unknown as { [key: string]: number }[]

	const remainder = ((value / roundToPlaces) % reports.length) * roundToPlaces
	const valueToDistribute = (value - remainder) / reports.length

	reports.forEach((report) => {
		const diffAdded = round((report[key] ?? 0) + valueToDistribute, roundToPlaces)
		report[key] = diffAdded
	})

	const reportLast = reports[reports.length - 1]
	reportLast[key] = (reportLast[key] ?? 0) + remainder
}

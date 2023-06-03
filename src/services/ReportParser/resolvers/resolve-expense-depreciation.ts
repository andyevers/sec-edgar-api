import { ReportTranslated } from '../../../types'
import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getRoundToPlaces, getSingleNullKey, round, splitValueBetweenReports } from './helpers'

export function resolveExpenseDepreciation(report: ReportWrapper): void {
	// return if both values are already set
	if (report.expenseDepreciation !== null && report.assetNonCurrentPPEGross !== null) return

	const reportTTMCurrentYear = report.getReportOffset(0, 'ANNUAL')

	// get report to get value for, prioritizing TTM current year. Used to get percent of depreciation relative to PPE
	const reportTTMOrPrev =
		reportTTMCurrentYear ?? report.getReportOffset(-1, 'ANNUAL') ?? report.getReportOffset(-1, 'QUARTERLY')

	const expenseDepreciationTTMOrPrev = reportTTMOrPrev?.expenseDepreciation ?? null
	const assetNonCurrentPPEGrossTTMOrPrev = reportTTMOrPrev?.assetNonCurrentPPEGross ?? null

	// both values must be set to resolve
	if (expenseDepreciationTTMOrPrev === null || assetNonCurrentPPEGrossTTMOrPrev === null) {
		return
	}

	const percentOfPPE = getDepreciationPercentOfPPE(report)
	if (percentOfPPE === null) return

	const { expenseDepreciation, assetNonCurrentPPEGross } = report as ExcludeNulls<ReportTranslated>
	const nullKey = getSingleNullKey({ expenseDepreciation, assetNonCurrentPPEGross })

	if (!nullKey) return

	const valueTTMOrPrev =
		nullKey === 'expenseDepreciation' ? expenseDepreciationTTMOrPrev : assetNonCurrentPPEGrossTTMOrPrev

	// follow the same rounding as the other report values
	const roundToPlaces = getRoundToPlaces(valueTTMOrPrev)

	const resolveReport = (rep: ReportTranslated) => {
		const { expenseDepreciation, assetNonCurrentPPEGross } = rep as ExcludeNulls<ReportTranslated>
		const nullKeyRep = getSingleNullKey({ expenseDepreciation, assetNonCurrentPPEGross })
		if (nullKey !== nullKeyRep) return false

		switch (nullKey) {
			case 'expenseDepreciation':
				rep.expenseDepreciation = round(assetNonCurrentPPEGross * percentOfPPE, roundToPlaces)
				break

			case 'assetNonCurrentPPEGross':
				rep.assetNonCurrentPPEGross = round(expenseDepreciation / percentOfPPE, roundToPlaces)
				break
		}

		return true
	}

	// if we have all reports for the year and we know the value of TTM, need to make sure the estimated values add up to the TTM value
	if (reportTTMCurrentYear) {
		const { Q1, Q2, Q3, Q4 } = report.getReportsFiscalYearByPeriod()
		const reportsEstimated: ReportTranslated[] = []

		// all reports that get estimated must be resolved to make sure the estimated values add up to the TTM value
		let didResolveAllEstimated = true
		for (const rep of [Q1, Q2, Q3, Q4]) {
			if (rep && rep?.[nullKey] === null) {
				didResolveAllEstimated = resolveReport(rep) && didResolveAllEstimated
				reportsEstimated.push(rep)
			}
		}

		if (didResolveAllEstimated && reportsEstimated.length > 0 && Q1 && Q2 && Q3 && Q4) {
			// const
			const estimationDifference = [Q1, Q2, Q3, Q4].reduce(
				(remainingDiff, rep) => remainingDiff - Number(rep[nullKey] ?? 0),
				Number(reportTTMCurrentYear[nullKey]),
			)

			// divide as evenly as possible between the reports, and give the leftover to the last estimated report
			splitValueBetweenReports({
				key: nullKey,
				reports: reportsEstimated,
				roundToPlaces,
				value: estimationDifference,
			})
		}
	} else {
		resolveReport(report)
	}
}

function getDepreciationPercentOfPPE(report: ReportWrapper) {
	const reportTTMOrPrev =
		report.getReportOffset(0, 'ANNUAL') ??
		report.getReportOffset(-1, 'ANNUAL') ??
		report.getReportOffset(-1, 'QUARTERLY')

	const expenseDepreciationTTMOrPrev = reportTTMOrPrev?.expenseDepreciation ?? null
	const assetNonCurrentPPEGrossTTMOrPrev = reportTTMOrPrev?.assetNonCurrentPPEGross ?? null

	if (!reportTTMOrPrev || expenseDepreciationTTMOrPrev === null || assetNonCurrentPPEGrossTTMOrPrev === null) {
		return null
	}

	// if checking depreciation using an annual report, we need to get the sum of the quarters
	let ppeDenominator = assetNonCurrentPPEGrossTTMOrPrev
	if (reportTTMOrPrev.isTTM && !report.isTTM) {
		const { Q1, Q2, Q3, Q4 } = reportTTMOrPrev.getReportsFiscalYearByPeriod()
		ppeDenominator = 0
		for (const rep of [Q1, Q2, Q3, Q4]) {
			const assetNonCurrentPPEGross = rep?.assetNonCurrentPPEGross
			if (typeof assetNonCurrentPPEGross !== 'number') return null
			ppeDenominator += assetNonCurrentPPEGross
		}
	}

	return expenseDepreciationTTMOrPrev / ppeDenominator
}

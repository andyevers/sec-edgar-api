import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getRoundToPlaces, round } from './helpers'

// TODO: make this more accurate.
export function resolveCashFlowOperating(report: ReportWrapper): void {
	if (report.cashFlowOperating !== null) return
	const { FY, Q1, Q2, Q3, Q4 } = report.getReportsFiscalYearByPeriod()
	const cashFlowOperatingFY = FY ? FY.cashFlowOperating : null

	if (cashFlowOperatingFY !== null) {
		const roundToPlaces = getRoundToPlaces(cashFlowOperatingFY)

		// all reports that get estimated must be resolved to make sure the estimated values add up to the TTM value
		for (const rep of [Q1, Q2, Q3, Q4]) {
			if (rep && rep.cashFlowOperating === null) {
				const cashFlowOperating = getCashFlowOperating(rep)
				if (cashFlowOperating === null) continue
				report.cashFlowOperating = round(cashFlowOperating, roundToPlaces)
			}
		}
	} else {
		report.cashFlowOperating = getCashFlowOperating(report)
	}
}

function getCashFlowOperating(report: ReportWrapper) {
	const reportPrev = report.getReportOffset(-1, report.fiscalPeriod === 'FY' ? 'ANNUAL' : 'QUARTERLY')

	if (!reportPrev) return null

	const { incomeNet, expenseDepreciation, cashFlowWorkingCapitalNonCash } = report as ExcludeNulls<typeof report>
	const cashFlowWorkingCapitalNonCashPrev = reportPrev.cashFlowWorkingCapitalNonCash

	if (cashFlowWorkingCapitalNonCash === null || cashFlowWorkingCapitalNonCashPrev === null) return null
	const changeInWorkingCapitalNonCash = cashFlowWorkingCapitalNonCash - cashFlowWorkingCapitalNonCashPrev

	return incomeNet + expenseDepreciation - changeInWorkingCapitalNonCash
}

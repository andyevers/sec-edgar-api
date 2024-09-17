import ReportWrapper from '../ReportWrapper'
import { getRoundToPlaces, splitValueBetweenReports } from './helpers'

/**
 * This only an estimate. splits remaining capex between quarters if FY has capex, or adds quarterly capex if Quarters have it
 */
export function resolveCashFlowCapex(report: ReportWrapper): void {
	if (report.cashFlowCapex !== null) return

	const isFY = report.fiscalPeriod === 'FY'
	const reportPrev = report.getReportOffset(-1, isFY ? 'ANNUAL' : 'QUARTERLY')
	const { FY, Q1, Q2, Q3, Q4 } = report.getReportsFiscalYearByPeriod()

	if (FY === null) {
		report.cashFlowCapex = reportPrev?.cashFlowCapex ?? null
		return
	}

	const sumQuarters = [Q1, Q2, Q3, Q4].reduce((sum, rep) => sum + (rep?.cashFlowCapex ?? 0), 0)
	const reportsQuarterlyWithoutCapex = [Q1, Q2, Q3, Q4].filter((rep) => rep && rep.cashFlowCapex === null)

	if (isFY) {
		if (reportsQuarterlyWithoutCapex.length === 0) report.cashFlowCapex = sumQuarters
		return
	}

	const reportTTMOrPrev =
		report.getReportOffset(0, 'ANNUAL') ??
		report.getReportOffset(-1, 'ANNUAL') ??
		report.getReportOffset(-1, 'QUARTERLY')

	const roundToPlaces = getRoundToPlaces(Number(reportTTMOrPrev?.cashFlowCapex))
	const cashFlowCapexFY = FY.cashFlowCapex

	if (cashFlowCapexFY !== null) {
		splitValueBetweenReports({
			key: 'cashFlowCapex',
			reports: reportsQuarterlyWithoutCapex as ReportWrapper[],
			roundToPlaces,
			value: cashFlowCapexFY - sumQuarters,
		})
	}
}

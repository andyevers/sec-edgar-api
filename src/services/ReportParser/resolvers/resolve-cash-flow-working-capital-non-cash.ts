import ReportWrapper from '../ReportWrapper'

// TODO: See if this can be more accurate to improve the accuracy of cashFlowOperating
export function resolveCashFlowWorkingCapitalNonCash(report: ReportWrapper) {
	if (report.cashFlowWorkingCapitalNonCash !== null) return

	// the previous report is used to calculate the change in working capital in resolveCashFlowOperating
	const reportWrapperPrev = report.getReportOffset(-1, report.isTTM ? 'ANNUAL' : 'QUARTERLY')
	const { FY, Q1, Q2, Q3, Q4 } = report.getReportsFiscalYearByPeriod()

	for (const report of [FY, Q1, Q2, Q3, Q4, reportWrapperPrev]) {
		const { assetCurrent, assetCurrentCashEquivalents, liabilityCurrent, liabilityCurrentDebt } = report ?? {}

		const isMissingProps = !report || !assetCurrent || !assetCurrentCashEquivalents || !liabilityCurrent

		if (isMissingProps || report.cashFlowWorkingCapitalNonCash !== null) continue
		const assetsCurrentLessCash = assetCurrent - assetCurrentCashEquivalents
		const liabilitiesCurrentLessDebt = liabilityCurrent - (liabilityCurrentDebt ?? 0)

		report.cashFlowWorkingCapitalNonCash = assetsCurrentLessCash - liabilitiesCurrentLessDebt
	}
}

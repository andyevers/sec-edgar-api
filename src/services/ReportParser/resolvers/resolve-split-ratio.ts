import ReportWrapper from '../ReportWrapper'

export function resolveSplitRatio(report: ReportWrapper): void {
	const { Q1, Q2, Q3, Q4 } = report.getReportsFiscalYearByPeriod()

	let splitReport: ReportWrapper | null = null
	// FY will have already been matched with Q4 from resolve-q4-fiscal-year-matching-properties.ts
	const takenRatios = new Set<number>()
	for (const report of [Q4, Q3, Q2, Q1]) {
		if (!report?.splitRatio) continue
		if (takenRatios.has(report.splitRatio)) {
			report.splitRatio = null
			continue
		}
		splitReport = report
		takenRatios.add(report.splitRatio)
	}

	if (!splitReport) return
	const prevReports = [
		splitReport.getReportOffset(-1, 'QUARTERLY'),
		splitReport.getReportOffset(-2, 'QUARTERLY'),
		splitReport.getReportOffset(-3, 'QUARTERLY'),
		splitReport.getReportOffset(-4, 'QUARTERLY'),
		splitReport.getReportOffset(-1, 'ANNUAL'),
	]

	prevReports.forEach((prevReport) => {
		if (prevReport === splitReport) return
		if (prevReport && splitReport && prevReport.splitRatio === splitReport.splitRatio) {
			prevReport.splitRatio = null
		}
	})
}

import { ReportTranslated } from '../../../types'
import ReportWrapper from '../ReportWrapper'

/**
 * Properties that should be the same for Q4 and FY
 */
export function resolveQ4FiscalYearMatchingProperties(reportWrapper: ReportWrapper): void {
	const { FY, Q1, Q2, Q3, Q4 } = reportWrapper.getReportsFiscalYearByPeriod()

	if (!FY || !Q1 || !Q2 || !Q3 || !Q4) return

	// these properties should be the same for Q4 and FY
	matchProperty('assetNonCurrentPPEGross', Q4, FY)
	matchProperty('assetNonCurrentPPENet', Q4, FY)
	matchProperty('expenseDepreciationAccumulated', Q4, FY)
}

function matchProperty(propertyName: keyof ReportTranslated, reportA: ReportTranslated, reportB: ReportTranslated) {
	const isReportANull = reportA[propertyName] === null
	const value = isReportANull ? reportB[propertyName] : reportA[propertyName]
	if (typeof value !== 'number') return
	;(reportA as unknown as Record<string, number>)[propertyName] = value
	;(reportB as unknown as Record<string, number>)[propertyName] = value
}

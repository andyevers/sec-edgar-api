import type { ReportTranslated } from '../../../types'
import ReportWrapper from '../ReportWrapper'

/**
 * Properties where the quarters add up to FY resolved if 1 of the 5 reports is missing.
 */
export function resolveFiscalYearCumulativeProperties(report: ReportWrapper): void {
	const { FY, Q1, Q2, Q3, Q4 } = report.getReportsFiscalYearByPeriod()

	if (!FY || !Q1 || !Q2 || !Q3 || !Q4) return

	// these properties should be the same for Q4 and FY
	matchProperty('assetNonCurrentPPEGross', Q4, FY)
	matchProperty('assetNonCurrentPPENet', Q4, FY)
	matchProperty('expenseDepreciationAccumulated', Q4, FY)

	const keysToInclude = new Set<keyof ReportTranslated>([
		'cashFlowCapex',
		'cashFlowDeferredTax',
		'cashFlowDividendsPaid',
		'cashFlowDividendsPaidPreferred',
		'cashFlowFree',
		'cashFlowOperating',
		'cashFlowWorkingCapitalNonCash',
		'assetNonCurrentIntangibleLessGoodwill',
		'expenseDepreciation',
		'expenseInterest',
		'expenseNonCashOther',
		'expenseOperating',
		'expenseResearchDevelopment',
		'expenseStockCompensation',
		'expenseTax',
		'expenseTotal',
		'ebit',
		'ebitda',
		'eps',
		'epsDiluted',
		'incomeNet',
		'incomeOperating',
		'profitGross',
		'revenueCost',
		'revenueOperating',
		'revenueTotal',
	])

	const reportKeys = Object.keys(Q1) as (keyof ReportTranslated)[]
	const keysToResolve = reportKeys.filter((key) => {
		const reportsWithVal = [FY, Q1, Q2, Q3, Q4].filter((report) => {
			return typeof report[key] === 'number' && keysToInclude.has(key)
		})

		// we want to get the keys that are in 4 of the 5 reports
		return reportsWithVal.length === 4
	})

	for (const key of keysToResolve) {
		const valueFY = FY[key] as number

		// this will be the sum of the 3 quarters if a quarter is missing, and sum of 4 quarters if FY is missing
		const sumQuarters = [Q1, Q2, Q3, Q4].reduce((acc, rep) => acc + ((rep?.[key] as number) ?? 0), 0)

		// if FY is missing use the sum of the 4 quarters, otherwise use FY - sum of 3 other quarters
		if (typeof FY[key] !== 'number') {
			;(FY as unknown as Record<string, number>)[key] = sumQuarters
		} else {
			for (const rep of [Q1, Q2, Q3, Q4]) {
				if (rep && typeof rep[key] !== 'number') {
					;(rep as unknown as Record<string, number>)[key] =
						Math.round((valueFY - sumQuarters) * 10_000) / 10_000
					break
				}
			}
		}
	}
}

function matchProperty(propertyName: keyof ReportTranslated, reportA: ReportTranslated, reportB: ReportTranslated) {
	const isReportANull = reportA[propertyName] === null
	const value = isReportANull ? reportB[propertyName] : reportA[propertyName]
	if (typeof value !== 'number') return
	;(reportA as unknown as Record<string, number>)[propertyName] = value
	;(reportB as unknown as Record<string, number>)[propertyName] = value
}

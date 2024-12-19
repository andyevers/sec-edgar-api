import type { FiscalPeriod } from './report-raw.type'

export interface ReportTranslated {
	cik: number
	url: string | null
	dateReport: string
	dateFiled: string
	fiscalPeriod: FiscalPeriod
	fiscalYear: number
	splitDate: string | null
	splitRatio: number | null

	assetTotal: number | null
	assetCurrent: number | null
	assetCurrentCashEquivalents: number | null
	assetCurrentInvestments: number | null
	assetCurrentAccountsReceivable: number | null
	assetCurrentInventory: number | null

	assetNonCurrent: number | null
	assetNonCurrentPPENet: number | null
	assetNonCurrentPPEGross: number | null
	assetNonCurrentInvestments: number | null
	assetNonCurrentGoodwill: number | null
	assetNonCurrentIntangibleLessGoodwill: number | null

	liabilityTotal: number | null
	liabilityCurrent: number | null
	liabilityCurrentAccountsPayable: number | null
	liabilityCurrentDebt: number | null
	liabilityNonCurrent: number | null
	liabilityNonCurrentDebt: number | null

	equityTotal: number | null
	equityRetainedEarnings: number | null
	equityStockPreferred: number | null

	sharesOutstanding: number | null
	sharesOutstandingDiluted: number | null

	eps: number | null
	epsDiluted: number | null

	ebit: number | null
	ebitda: number | null

	profitGross: number | null

	revenueTotal: number | null
	revenueCost: number | null
	revenueOperating: number | null

	expenseTotal: number | null
	expenseOperating: number | null
	expenseResearchDevelopment: number | null
	expenseInterest: number | null
	expenseDepreciation: number | null
	expenseTax: number | null

	expenseDepreciationAccumulated: number | null
	expenseStockCompensation: number | null
	expenseNonCashOther: number | null

	incomeOperating: number | null
	incomeNet: number | null

	cashFlowFree: number | null
	cashFlowDividendsPaid: number | null
	cashFlowDividendsPaidPreferred: number | null

	cashFlowCapex: number | null
	cashFlowOperating: number | null
	cashFlowDeferredTax: number | null

	cashFlowWorkingCapitalNonCash: number | null
}

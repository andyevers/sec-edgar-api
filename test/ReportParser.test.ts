import ReportParser from '../src/services/ReportParser'
import { ReportRaw, ReportTranslated } from '../src/types'
import { companyFacts } from './__fixtures__/company-facts'
import { reportsRaw } from './__fixtures__/reports-raw'

describe('ReportParser', () => {
	const reportParser = new ReportParser()

	test('parseReportsRaw', () => {
		const reportsRaw = reportParser.parseReportsRaw(companyFacts)

		expect(reportsRaw).toContainEqual({
			cik: 320193,
			url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019323000006/0000320193-23-000006.txt',
			dateFiled: '2023-02-03',
			dateReport: '2022-12-31',
			fiscalPeriod: 'Q1',
			fiscalYear: 2023,
			splitDate: null,
			splitRatio: null,
			EntityCommonStockSharesOutstanding: 15821946000,
			AccountsPayableCurrent: 57918000000,
			AccountsReceivableNetCurrent: 23752000000,
			NetIncomeLoss: 29998000000,
		})
	})

	test('parseReportsFromRaw', () => {
		const reports = reportParser.parseReportsFromRaw(reportsRaw as unknown as ReportRaw[])

		const _report = reports.find((r) => r.fiscalPeriod === 'Q1' && r.fiscalYear === 2022)
		const _reportRaw = reportsRaw.find((r) => r.fiscalPeriod === 'Q1' && r.fiscalYear === 2022)

		const report = _report as ReportTranslated
		const reportRaw = _reportRaw as (typeof reportsRaw)[0]

		expect(report).toBeDefined()
		expect(reportRaw).toBeDefined()

		expect(report.dateReport).toBe(reportRaw.dateReport)
		expect(report.dateFiled).toBe(reportRaw.dateFiled)
		expect(report.fiscalPeriod).toBe(reportRaw.fiscalPeriod)
		expect(report.fiscalYear).toBe(reportRaw.fiscalYear)
		// expect(report.form).toBe(reportRaw.form)
		// expect(report.isTTM).toBe(reportRaw.isTTM)

		expect(report.assetTotal).toBe(reportRaw.Assets)
		expect(report.assetCurrent).toBe(reportRaw.AssetsCurrent)
		expect(report.assetCurrentCashEquivalents).toBe(reportRaw.CashAndCashEquivalentsAtCarryingValue)
		expect(report.assetCurrentAccountsReceivable).toBe(reportRaw.AccountsReceivableNetCurrent)
		expect(report.assetCurrentInventory).toBe(reportRaw.InventoryNet)

		expect(report.assetNonCurrent).toBe(reportRaw.AssetsNoncurrent)
		expect(report.assetNonCurrentPPENet).toBe(reportRaw.PropertyPlantAndEquipmentNet)
		expect(report.assetNonCurrentPPEGross).toBe(reportRaw.PropertyPlantAndEquipmentGross)
		expect(report.assetNonCurrentGoodwill).toBeNull()
		expect(report.assetNonCurrentIntangibleLessGoodwill).toBeNull()

		expect(report.liabilityTotal).toBe(reportRaw.Liabilities)
		expect(report.liabilityCurrent).toBe(reportRaw.LiabilitiesCurrent)
		expect(report.liabilityCurrentAccountsPayable).toBe(reportRaw.AccountsPayableCurrent)
		expect(report.liabilityCurrentDebt).toBe(reportRaw.LongTermDebtCurrent)

		expect(report.liabilityNonCurrent).toBe(reportRaw.LiabilitiesNoncurrent)
		expect(report.liabilityNonCurrentDebt).toBe(reportRaw.LongTermDebtNoncurrent)

		expect(report.equityTotal).toBe(reportRaw.StockholdersEquity)
		expect(report.equityRetainedEarnings).toBe(reportRaw.RetainedEarningsAccumulatedDeficit)
		expect(report.sharesOutstandingDiluted).toBe(reportRaw.WeightedAverageNumberOfDilutedSharesOutstanding)

		expect(report.eps).toBe(reportRaw.EarningsPerShareBasic)
		expect(report.epsDiluted).toBe(reportRaw.EarningsPerShareDiluted)
		expect(report.ebit).toBe(reportRaw.OperatingIncomeLoss)

		expect(report.profitGross).toBe(reportRaw.GrossProfit)
		expect(report.revenueCost).toBe(reportRaw.CostOfGoodsAndServicesSold)

		expect(report.expenseOperating).toBe(reportRaw.OperatingExpenses)
		expect(report.expenseResearchDevelopment).toBe(reportRaw.ResearchAndDevelopmentExpense)
		expect(report.expenseInterest).toBe(reportRaw.InterestExpense)
		expect(report.expenseTax).toBe(reportRaw.IncomeTaxExpenseBenefit)

		expect(report.expenseDepreciationAccumulated).toBe(
			reportRaw.AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment,
		)
		expect(report.expenseStockCompensation).toBe(reportRaw.ShareBasedCompensation)
		expect(report.expenseNonCashOther).toBe(reportRaw.OtherNoncashIncomeExpense)

		expect(report.incomeOperating).toBe(reportRaw.OperatingIncomeLoss)
		expect(report.incomeNet).toBe(reportRaw.NetIncomeLoss)
		// other properties tested in resolver tests.
	})

	test('resolvers', () => {
		const reports = reportParser.parseReportsFromRaw(reportsRaw as unknown as ReportRaw[])
		const report = reports.find((r) => r.fiscalPeriod === 'Q2' && r.fiscalYear === 2022) as ReportTranslated

		// actual value for Q2 2022 is 2,737,000,000.
		expect(report.expenseDepreciation).toBe(2_738_000_000)

		// actual value for Q2 2022 is 28,166,000,000. Need to make this more accurate.
		expect(report.cashFlowOperating).toBe(23_609_000_000)
	})
})

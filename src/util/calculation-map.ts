import { CalculationMapCondensed, ReportTranslated } from '../types'

export const calculationMapCondensed: CalculationMapCondensed<ReportTranslated> = {
	cik: [],
	url: [],
	dateReport: [],
	dateFiled: [],
	fiscalPeriod: [],
	fiscalYear: [],
	splitDate: [],
	splitRatio: [],

	assetCurrent: [[['us-gaap:AssetsCurrent', 1, 0]]],
	assetCurrentAccountsReceivable: [
		[['us-gaap:AccountsReceivableNetCurrent', 1, 0]],
		[['ReceivablesNetCurrent', 1, 0]],
		[['AccountsReceivableNet', 1, 0]],
		[['AccountsNotesAndLoansReceivableNetCurrent', 1, 0]],
		[['AccountsAndOtherReceivablesNetCurrent', 1, 0]],
	],
	assetCurrentCashEquivalents: [
		[['us-gaap:CashAndCashEquivalentsAtCarryingValue', 1, 0]],
		[['us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 1, 0]],
		[['us-gaap:CashAndDueFromBanks', 1, 0]],
	],
	assetCurrentInventory: [[['us-gaap:InventoryNet', 1, 0]]],
	assetCurrentInvestments: [[['us-gaap:MarketableSecuritiesCurrent', 1, 0]]],
	assetNonCurrent: [
		[
			['us-gaap:AssetsCurrent', -1, 0],
			['us-gaap:Assets', 1, 0],
		],
	],
	assetNonCurrentGoodwill: [[['us-gaap:Goodwill', 1, 0]]],
	assetNonCurrentIntangibleLessGoodwill: [
		[['us-gaap:IntangibleAssetsNetExcludingGoodwill', 1, 0]],
		[
			['us-gaap:FiniteLivedIntangibleAssetsNet', 1, 0],
			['us-gaap:IndefiniteLivedIntangibleAssetsExcludingGoodwill', 1, 0],
		],
	],
	assetNonCurrentInvestments: [
		[['us-gaap:LongTermInvestments', 1, 0]],
		[['us-gaap:InvestmentsInAffiliatesSubsidiariesAssociatesAndJointVentures', 1, 0]],
		[['us-gaap:EquityMethodInvestments', 1, 0]],
	],
	assetNonCurrentPPEGross: [
		[
			['expenseDepreciationAccumulated', 1, 0],
			['assetNonCurrentPPENet', 1, 0],
		],
	],
	assetNonCurrentPPENet: [
		[['us-gaap:PropertyPlantAndEquipmentNet', 1, 0]],
		[
			['us-gaap:OperatingLeaseRightOfUseAsset', 1, 0],
			[
				'us-gaap:PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization',
				1,
				0,
			],
		],
		[
			['us-gaap:CapitalizedContractCostNetNoncurrent', 1, 0],
			['us-gaap:OperatingLeaseRightOfUseAsset', 1, 0],
			['us-gaap:PropertyPlantAndEquipmentNet', 1, 0],
		],
	],
	assetTotal: [[['us-gaap:LiabilitiesAndStockholdersEquity', 1, 0]], [['us-gaap:Assets', 1, 0]]],
	cashFlowCapex: [[['us-gaap:PaymentsToAcquirePropertyPlantAndEquipment', 1, 0]]],
	cashFlowDeferredTax: [
		[
			['us-gaap:DeferredIncomeTaxExpenseBenefit', 1, 0],
			['us-gaap:ProfitLoss', 1, 0],
		],
	],
	cashFlowDividendsPaid: [
		[['us-gaap:PaymentsOfDividends', 1, 0]],
		[['us-gaap:PaymentsOfDividendsCommonStock', 1, 0]],
	],
	cashFlowDividendsPaidPreferred: [[['us-gaap:DividendsPreferredStock', 1, 0]]],
	cashFlowFinancing: [[['us-gaap:NetCashProvidedByUsedInFinancingActivities', 1, 0]]],
	cashFlowFree: [
		[
			['cashFlowCapex', -1, 1],
			['cashFlowOperating', 1, 1],
		],
	],
	cashFlowInvesting: [[['us-gaap:NetCashProvidedByUsedInInvestingActivities', 1, 0]]],
	cashFlowOperating: [[['us-gaap:NetCashProvidedByUsedInOperatingActivities', 1, 0]]],
	cashFlowWorkingCapitalNonCash: [
		[
			['assetCurrent', 1, 1],
			['assetCurrentCashEquivalents', -1, 1],
			['liabilityCurrent', -1, 1],
			['liabilityCurrentDebt', 1, 0],
		],
	],
	ebit: [
		[
			['expenseInterest', 1, 0],
			['incomeNet', 1, 0],
			['expenseTax', 1, 0],
		],
	],
	ebitda: [
		[
			['expenseDepreciation', 1, 0],
			['expenseTax', 1, 0],
			['expenseInterest', 1, 0],
			['incomeNet', 1, 1],
		],
	],
	eps: [[['us-gaap:EarningsPerShareBasic', 1, 0]], [['us-gaap:EarningsPerShareBasicAndDiluted', 1, 0]]],
	epsDiluted: [[['us-gaap:EarningsPerShareDiluted', 1, 0]], [['us-gaap:EarningsPerShareBasicAndDiluted', 1, 0]]],
	equityRetainedEarnings: [[['us-gaap:RetainedEarningsAccumulatedDeficit', 1, 0]]],
	equityTotal: [
		[['us-gaap:StockholdersEquity', 1, 0]],
		[['us-gaap:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 1, 0]],
	],
	expenseDepreciation: [
		[['us-gaap:DepreciationDepletionAndAmortization', 1, 0]],
		[['us-gaap:DepreciationAndAmortization', 1, 0]],
		[
			['us-gaap:Depreciation', 1, 0],
			['us-gaap:AmortizationOfIntangibleAssets', 1, 0],
		],
		[
			['us-gaap:DepreciationAmortizationAndAccretionNet', 1, 0],
			['us-gaap:OtherAmortizationOfDeferredCharges', 1, 0],
		],
		[
			['us-gaap:AssetRetirementObligationAccretionExpense', 1, 0],
			['us-gaap:DepreciationDepletionAndAmortization', 1, 0],
			['us-gaap:GainLossOnSaleOfPropertyPlantEquipment', -1, 0],
		],
	],
	expenseDepreciationAccumulated: [
		[['us-gaap:AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment', 1, 0]],
		[
			[
				'us-gaap:PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAccumulatedDepreciationAndAmortization',
				1,
				0,
			],
		],
		[
			[
				'us-gaap:PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization',
				1,
				0,
			],
			[
				'us-gaap:PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetBeforeAccumulatedDepreciationAndAmortization',
				-1,
				0,
			],
		],
		[
			['assetNonCurrentPPEGross', 1, 1],
			['assetNonCurrentPPENet', -1, 1],
		],
	],
	expenseInterest: [[['us-gaap:InterestExpense', 1, 0]]],
	expenseNonCashOther: [
		[
			['us-gaap:AmortizationOfFinancingCosts', -1, 0],
			['us-gaap:OperatingLeaseRightOfUseAssetAmortizationExpense', -1, 0],
			['us-gaap:OtherNoncashIncomeExpense', 1, 1],
		],
		[
			['us-gaap:RepaymentsOfLongTermDebt', 1, 1],
			['us-gaap:ProceedsFromRepaymentsOfShortTermDebtMaturingInThreeMonthsOrLess', -1, 0],
			['us-gaap:ProceedsFromShortTermDebtMaturingInMoreThanThreeMonths', -1, 0],
		],
	],
	expenseOperating: [
		[['us-gaap:OperatingExpenses', 1, 1]],
		[
			['expenseSellingGeneralAdministrative', 1, 1],
			['expenseResearchDevelopment', 1, 0],
			['expenseDepreciation', 1, 0],
			['us-gaap:ProvisionForDoubtfulAccounts', 1, 0],
		],
	],
	expenseResearchDevelopment: [[['us-gaap:ResearchAndDevelopmentExpense', 1, 0]]],
	expenseSellingGeneralAdministrative: [
		[['us-gaap:SellingGeneralAndAdministrativeExpense', 1, 0]],
		[
			['us-gaap:GeneralAndAdministrativeExpense', 1, 0],
			['us-gaap:SellingAndMarketingExpense', 1, 0],
		],
	],
	expenseStockCompensation: [[['us-gaap:ShareBasedCompensation', 1, 0]]],
	expenseTax: [[['us-gaap:IncomeTaxExpenseBenefit', 1, 0]]],
	expenseTotal: [
		[
			['incomeNet', -1, 1],
			['revenueTotal', 1, 1],
		],
		[['us-gaap:CostsAndExpenses', 1, 1]],
	],
	incomeNet: [
		[['us-gaap:NetIncomeLoss', 1, 1]],
		[
			['incomePretax', 1, 1],
			['expenseTax', -1, 1],
		],
	],
	incomeOperating: [[['us-gaap:OperatingIncomeLoss', 1, 1]]],
	incomePretax: [
		[
			['us-gaap:OperatingIncomeLoss', 1, 0],
			['us-gaap:NonoperatingIncomeExpense', 1, 0],
		],
		[['us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 1, 0]],
	],
	liabilityCurrent: [[['us-gaap:LiabilitiesCurrent', 1, 0]]],
	liabilityCurrentAccountsPayable: [[['us-gaap:AccountsPayableCurrent', 1, 0]]],
	liabilityCurrentDebt: [
		[['us-gaap:DebtCurrent', 1, 1]],
		[
			['us-gaap:LongTermDebtAndCapitalLeaseObligationsCurrent', 1, 1],
			['us-gaap:ShortTermBorrowings', 1, 0],
		],
		[
			['us-gaap:LongTermDebtCurrent', 1, 1],
			['us-gaap:FinanceLeaseLiabilityCurrent', 1, 0],
			['us-gaap:ShortTermBorrowings', 1, 0],
		],
		[['us-gaap:ShortTermBorrowings', 1, 0]],
	],
	liabilityNonCurrent: [
		[['us-gaap:LiabilitiesNoncurrent', 1, 0]],
		[
			['liabilityTotal', 1, 1],
			['liabilityCurrent', -1, 1],
		],
	],
	liabilityNonCurrentDebt: [
		[['us-gaap:LongTermDebtNoncurrent', 1, 0]],
		[['us-gaap:LongTermDebtAndCapitalLeaseObligations', 1, 0]],
	],
	liabilityTotal: [
		[['us-gaap:Liabilities', 1, 0]],
		[
			['us-gaap:LiabilitiesCurrent', 1, 0],
			['us-gaap:LiabilitiesNoncurrent', 1, 0],
		],
	],
	profitGross: [
		[['us-gaap:GrossProfit', 1, 0]],
		[
			['revenueTotal', 1, 0],
			['revenueCost', -1, 0],
		],
	],
	revenueCost: [
		[['us-gaap:CostOfRevenue', 1, 0]],
		[['us-gaap:CostOfGoodsAndServicesSold', 1, 0]],
		[['us-gaap:CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization', -1, 0]],
	],
	revenueOperating: [
		[
			['us-gaap:CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization', -1, 0],
			['us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax', 1, 0],
		],
		[
			['revenueCost', 1, 1],
			['profitGross', 1, 1],
		],
	],
	revenueTotal: [
		[['us-gaap:Revenues', 1, 1]],
		[
			['us-gaap:CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization', -1, 0],
			['us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax', 1, 1],
		],
		[['us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax', 1, 1]],
		[['ifrs-full:Revenue', 1, 1]],
		[
			['revenueCost', 1, 1],
			['profitGross', 1, 1],
		],
	],
	sharesOutstanding: [
		[['us-gaap:WeightedAverageNumberOfSharesOutstandingBasic', 1, 0]],
		[['us-gaap:CommonStockSharesOutstanding', 1, 0]],
		[['dei:EntityCommonStockSharesOutstanding', 1, 0]],
		[['us-gaap:WeightedAverageNumberOfSharesOutstandingBasicAndDiluted', 1, 0]],
	],
	sharesOutstandingDiluted: [
		[['us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding', 1, 0]],
		[['us-gaap:WeightedAverageNumberOfSharesOutstandingBasicAndDiluted', 1, 0]],
	],
}

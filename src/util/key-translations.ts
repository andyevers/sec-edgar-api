import type { ReportTranslated } from '../types/report-translated.type'

/**
 * Checks if any of the array keys exist in the object to assign to the translated key
 * These were checked against Yahoo Finance values, adding the ones that most often matched the yahoo values
 */
const keyTranslations: Record<keyof ReportTranslated, string[]> = {
	// --- Added from ReportParser --- //
	cik: ['cik'],
	url: ['url'],
	dateReport: ['dateReport'],
	dateFiled: ['dateFiled'],
	fiscalPeriod: ['fiscalPeriod'],
	fiscalYear: ['fiscalYear'],
	splitDate: ['splitDate'],
	splitRatio: ['StockholdersEquityNoteStockSplitConversionRatio1'],
	// ------------------------------- //
	assetTotal: ['Assets'],
	assetCurrent: ['AssetsCurrent', 'CurrentAssets'],
	assetCurrentCashEquivalents: [
		'CashAndCashEquivalentsAtCarryingValue',
		'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
		'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations',
		'CashAndCashEquivalents',
		'Cash',
		'CashAndCashEquivalentsFairValueDisclosure',
		'CashCashEquivalentsAndShortTermInvestments',
		'CashAndCashEquivalentsAtCarryingValueIncludingDiscontinuedOperations',
		'CashAndCashEquivalentsIfDifferentFromStatementOfFinancialPosition',
		'CashAndDueFromBanks',
		'CashAndBankBalancesAtCentralBanks',
	],
	assetCurrentInvestments: [
		'ShortTermInvestments',
		'MarketableSecuritiesCurrent',
		'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
		'AvailableForSaleSecuritiesDebtSecurities',
		'OtherShortTermInvestments',
		'AvailableForSaleSecuritiesDebtMaturitiesWithinOneYearFairValue',
		'Investments',
		'DebtSecuritiesAvailableForSaleExcludingAccruedInterestCurrent',
		'SecuritiesPurchasedUnderAgreementsToResell',
		'OtherCurrentFinancialAssets',
		'EquitySecuritiesFvNi',
		'MarketableSecurities',
	],
	assetCurrentAccountsReceivable: [
		'AccountsReceivableNetCurrent',
		'ReceivablesNetCurrent',
		'AccountsReceivableNet',
		'AccountsNotesAndLoansReceivableNetCurrent',
		'AccountsAndOtherReceivablesNetCurrent',
	],
	assetCurrentInventory: [
		'InventoryNet',
		'Inventories',
		'InventoryFinishedGoodsNetOfReserves',
		'InventoryNetOfAllowancesCustomerAdvancesAndProgressBillings',
		'InventoryGross',
	],
	assetNonCurrent: ['AssetsNonCurrent', 'NonCurrentAssets'],
	assetNonCurrentGoodwill: ['Goodwill'],
	assetNonCurrentIntangibleLessGoodwill: ['IntangibleAssetsNetExcludingGoodwill'],
	assetNonCurrentPPENet: [
		'PropertyPlantAndEquipmentNet',
		// 'PropertyPlantAndEquipmentGross',
		'PropertyPlantAndEquipment',
		'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization',
	],
	assetNonCurrentPPEGross: ['PropertyPlantAndEquipmentGross'],
	assetNonCurrentInvestments: [
		'LongTermInvestments',
		'InvestmentsInAffiliatesSubsidiariesAssociatesAndJointVentures',
		'EquityMethodInvestments',
	],
	liabilityTotal: ['Liabilities'],
	liabilityCurrent: ['LiabilitiesCurrent', 'CurrentLiabilities'],
	liabilityCurrentAccountsPayable: [
		'AccountsPayableCurrent',
		'AccountsPayableTradeCurrent',
		'AccountsPayableAndAccruedLiabilitiesCurrent',
		'TradeAndOtherCurrentPayables',
		'Deposits',
		'AccountsPayableCurrentAndNoncurrent',
		'AccountsPayableAndAccruedLiabilitiesCurrentAndNoncurrent',
	],
	liabilityCurrentDebt: ['LongTermDebtCurrent', 'DebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent'],
	liabilityNonCurrent: ['LiabilitiesNonCurrent', 'NonCurrentLiabilities'],
	liabilityNonCurrentDebt: [
		'LongTermDebtNoncurrent',
		'LongTermDebtAndCapitalLeaseObligations',
		'LongTermDebt',
		'UnsecuredLongTermDebt',
		'DebtLongtermAndShorttermCombinedAmount',
		'LongtermBorrowings',
		'ConvertibleLongTermNotesPayable',
		'LongTermNotesAndLoans',
		'DebtAndCapitalLeaseObligations',
		'LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities',
	],
	equityTotal: [
		'StockholdersEquity',
		'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
		'EquityAttributableToOwnersOfParent',
	],
	equityRetainedEarnings: ['RetainedEarningsAccumulatedDeficit', 'RetainedEarnings'],

	sharesOutstanding: ['WeightedAverageNumberOfSharesOutstandingBasic', 'CommonStockSharesOutstanding'],
	sharesOutstandingDiluted: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
	eps: ['EarningsPerShareBasic', 'EarningsPerShareBasicAndDiluted'],
	epsDiluted: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'],

	ebit: [], // Calculated property only. This is not provided in the reports
	ebitda: [],

	profitGross: ['GrossProfit'],

	revenueTotal: [
		'RevenueFromContractWithCustomerExcludingAssessedTax',
		'Revenues',
		'RevenueFromContractWithCustomerIncludingAssessedTax',
		'Revenue',
	],
	revenueCost: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfServices'],
	revenueOperating: [
		'OperatingIncomeLoss',
		'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
		'ProfitLossBeforeTax',
	],

	expenseTotal: ['CostsAndExpenses'],
	expenseOperating: ['OperatingExpenses', 'CostsAndExpenses'],
	expenseResearchDevelopment: [
		'ResearchAndDevelopmentExpense',
		'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
		'ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost',
	],
	expenseInterest: [
		'InterestExpense',
		'InterestIncomeExpenseNet',
		'InterestIncomeExpenseNonoperatingNet',
		'InterestRevenueExpenseNet',
	],
	expenseDepreciation: [
		'DepreciationDepletionAndAmortization',
		'DepreciationAndAmortization',
		'DepreciationAndAmortisationExpense',
		'DepreciationAmortizationAndAccretionNet',
		'Depreciation',
		'AdjustmentsForDepreciationAndAmortisationExpense',
		'AmortisationExpense',
	],
	expenseDepreciationAccumulated: ['AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment'],
	expenseTax: ['IncomeTaxExpenseBenefit', 'IncomeTaxExpenseContinuingOperations'],
	expenseNonCashOther: ['OtherNoncashIncomeExpense'],
	expenseSellingGeneralAdministrative: ['SellingGeneralAndAdministrativeExpense'],
	incomeOperating: [
		'OperatingIncomeLoss',
		'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
		'ProfitLossBeforeTax',
	],
	incomeNet: [
		'NetIncomeLoss',
		'NetIncomeLossAvailableToCommonStockholdersBasic',
		'ProfitLoss',
		'NetIncomeLossAvailableToCommonStockholdersDiluted',
		'IncomeLossFromContinuingOperations',
		'ProfitLossAttributableToOwnersOfParent',
	],

	cashFlowFree: [],
	cashFlowDividendsPaid: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'],
	cashFlowDividendsPaidPreferred: ['DividendsPreferredStock'],
	cashFlowCapex: ['PaymentsToAcquirePropertyPlantAndEquipment'],

	cashFlowOperating: ['NetCashProvidedByUsedInOperatingActivities'],
	cashFlowInvesting: ['NetCashProvidedByUsedInInvestingActivities'],
	cashFlowFinancing: ['NetCashProvidedByUsedInFinancingActivities'],

	cashFlowDeferredTax: ['DeferredIncomeTaxExpenseBenefit'],

	cashFlowWorkingCapitalNonCash: [],
	expenseStockCompensation: ['AllocatedShareBasedCompensationExpense'],
	incomePretax: [],
}

export default keyTranslations

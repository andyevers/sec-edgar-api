# SEC Edgar API

Fetch and parse earnings reports and other documents filed with the SEC using the EDGAR API.
This package is focused on the earnings reports for stock analysis.

Some main data points available include:

-   Earnings Reports
-   Insider Transactions
-   Institutional Holders
-   Filing History
-   Directors & Executives
-   Executive Compensation

## Installation

```SH
npm install sec-edgar-api
```

## Report Interface

Reports are all returned as a uniform interface:

```TS
interface ReportTranslated {
	dateReport: string
	dateFiled: string
	fiscalPeriod: FiscalPeriod
	fiscalYear: number
	form: string
	isTTM: boolean

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
```

## Usage

import package contents

```TS
import { secEdgarApi } from 'sec-edgar-api'
```

You can fetch reports individually directly from the SEC website, (throttled to 10 requests per second)

```TS
// returns array of ReportWrapper (which implements ReportTranslated)
const reports = await secEdgarApi.getReports({ symbol: 'AAPL' })
```

## Resolvers

**WARNING** Still in testing. Values may not be accurate for all companies since the properties provided in the reports differ.

The main problem with the edgar API is that the property names and data provided are not uniform. You have to deal with companies omitting important data
in some filings, or using different property keys for the same data point.

Resolvers attempt to get information from each report and output a uniform interface. The resolvers will calculate missing data if there is other data that can be used to derive from.

| Resolver                              | Formula used to derive values                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| resolveAssetCurrent                   | assetTotal - assetNonCurrent = assetCurrent                                                                              |
| resolveAssetNonCurrentPpeGross        | assetNonCurrentPPENet + expenseDepreciationAccumulated = assetNonCurrentPpeGross                                         |
| resolveCashFlowCapex                  | Q1 + Q2 + Q3 + Q4 = FY (if FY known, divides evenly between missing quarters)                                            |
| resolveCashFlowFree                   | cashFlowOperating - cashFlowCapex = cashFlowFree                                                                         |
| resolveCashFlowOperating              | incomeNet + expenseDepreciation - changeInWorkingCapitalNonCash = cashFlowOperating                                      |
| resolveCashFlowWorkingCapitalNonCash  | (assetCurrent - assetCurrentCashEquivalents) - (liabilityCurrent - liabilityCurrentDebt) = cashFlowWorkingCapitalNonCash |
| resolveEbit                           | expenseDepreciation + ebitda = ebit                                                                                      |
| resolveExpenseDepreciation            | (expenseDepreciationFY / assetNonCurrentPpeGrossFY) x assetNonCurrentPpeGross = expenseDepreciation                      |
| resolveExpenseOperating               | revenueTotal - incomeOperating - revenueCost = expenseOperating                                                          |
| resolveExpenseTotal                   | revenueTotal - incomeNet = expenseTotal                                                                                  |
| resolveFiscalYearCumulativeProperties | Q1 + Q2 + Q3 + Q4 = FY (for quarterly properties that add to annual)                                                     |
| resolveQ4FiscalYearMatchingProperties | Q4 = FY (for non-cumulative properties such as sharesOutstanding)                                                        |
| resolveRevenueTotal                   | revenueCost + profitGross = revenueTotal                                                                                 |

## Contributing

Getting all the properties in a uniform interface accurately is proving to be very difficult due to the differences in all the reports.
Please contribute if you know how to improve this.

Files for mapping & resolving properties:

-   Mapping properties: `src/util/key-translations.ts`
-   Resolving properties: `src/services/ReportParser.ts` (add resolvers to the `resolvers/` directory, import to `/resolver/index.ts`, and add to ReportParser.resolveAll)

### Resources

-   Validate resolved values: https://finance.yahoo.com/
-   Financial calculations: https://www.gurufocus.com/
-   Calculate change in working capital: https://www.oldschoolvalue.com/stock-valuation/change-in-working-capital/

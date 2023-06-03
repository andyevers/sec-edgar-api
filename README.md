# sec-edgar-api

Fetch and parse earnings reports and other documents filed with the SEC using the EDGAR API.
This package is focused on the earnings reports for stock analysis.

## Resolvers

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

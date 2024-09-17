import { resolveAssetCurrent } from './resolve-asset-current'
import { resolveAssetNonCurrentPPEGross } from './resolve-asset-non-current-ppe-gross'
import { resolveCashFlowCapex } from './resolve-cash-flow-capex'
import { resolveCashFlowFree } from './resolve-cash-flow-free'
import { resolveCashFlowOperating } from './resolve-cash-flow-operating'
import { resolveCashFlowWorkingCapitalNonCash } from './resolve-cash-flow-working-capital-non-cash'
import { resolveEbit } from './resolve-ebit'
import { resolveExpenseDepreciation } from './resolve-expense-depreciation'
import { resolveExpenseOperating } from './resolve-expense-operating'
import { resolveExpenseTotal } from './resolve-expense-total'
import { resolveFiscalYearCumulativeProperties } from './resolve-fiscal-year-cumulative-properties'
import { resolveLiabilityCurrent } from './resolve-liability-current'
import { resolveQ4FiscalYearMatchingProperties } from './resolve-q4-fiscal-year-matching-properties'
import { resolveRevenueTotal } from './resolve-revenue-total'
import { resolveSplitRatio } from './resolve-split-ratio'

const resolvers = {
	resolveAssetNonCurrentPPEGross,
	resolveExpenseDepreciation,
	resolveExpenseOperating,
	resolveCashFlowFree,
	resolveEbit,
	resolveAssetCurrent,
	resolveCashFlowCapex,
	resolveFiscalYearCumulativeProperties,
	resolveRevenueTotal,
	resolveExpenseTotal,
	resolveCashFlowOperating,
	resolveLiabilityCurrent,
	resolveQ4FiscalYearMatchingProperties,
	resolveCashFlowWorkingCapitalNonCash,
	resolveSplitRatio,
}

export default resolvers

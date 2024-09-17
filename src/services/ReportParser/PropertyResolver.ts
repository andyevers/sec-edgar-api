import ReportWrapper from '../ReportParser/ReportWrapper'
import resolvers from './resolvers'

export default class PropertyResolver {
	private readonly resolvers: typeof resolvers

	constructor(args = { resolvers }) {
		this.resolvers = args.resolvers
	}

	public getDefaultResolvers(): typeof resolvers {
		return { ...this.resolvers }
	}

	public resolveAll(reports: ReportWrapper[] | Map<string, ReportWrapper>) {
		reports.forEach((report) => {
			this.resolvers.resolveQ4FiscalYearMatchingProperties(report)
			this.resolvers.resolveFiscalYearCumulativeProperties(report)
			this.resolvers.resolveRevenueTotal(report)
			this.resolvers.resolveExpenseTotal(report)
			this.resolvers.resolveAssetCurrent(report)
			this.resolvers.resolveLiabilityCurrent(report)
			this.resolvers.resolveCashFlowWorkingCapitalNonCash(report)
			this.resolvers.resolveExpenseOperating(report)
			this.resolvers.resolveAssetNonCurrentPPEGross(report)
			this.resolvers.resolveEbit(report)
			this.resolvers.resolveExpenseDepreciation(report)
			this.resolvers.resolveCashFlowOperating(report)
			this.resolvers.resolveCashFlowCapex(report)
			this.resolvers.resolveCashFlowFree(report)
			this.resolvers.resolveSplitRatio(report)
		})
	}
}

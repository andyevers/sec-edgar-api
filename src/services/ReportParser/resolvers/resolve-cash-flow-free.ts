import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveCashFlowFree(report: ReportWrapper): void {
	const { cashFlowFree, cashFlowOperating, cashFlowCapex } = report as ExcludeNulls<typeof report>
	const nullKey = getSingleNullKey({ cashFlowFree, cashFlowOperating, cashFlowCapex })

	if (cashFlowOperating !== null && cashFlowCapex !== null) {
		report.cashFlowFree = cashFlowOperating - cashFlowCapex
	}

	switch (nullKey) {
		case 'cashFlowFree':
			report.cashFlowFree = cashFlowOperating - cashFlowCapex
			break

		case 'cashFlowCapex':
			report.cashFlowCapex = cashFlowOperating - cashFlowFree
			break

		case 'cashFlowOperating':
			report.cashFlowOperating = cashFlowFree + cashFlowCapex
			break
	}
}

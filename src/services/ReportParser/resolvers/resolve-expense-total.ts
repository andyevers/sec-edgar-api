import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveExpenseTotal(report: ReportWrapper): void {
	const { revenueTotal, incomeNet, expenseTotal } = report as ExcludeNulls<typeof report>
	const nullKey = getSingleNullKey({ revenueTotal, incomeNet, expenseTotal })

	switch (nullKey) {
		case 'revenueTotal':
			report.revenueTotal = incomeNet + expenseTotal
			break

		case 'incomeNet':
			report.incomeNet = revenueTotal - expenseTotal
			break

		case 'expenseTotal':
			report.expenseTotal = revenueTotal - incomeNet
			break
	}
}

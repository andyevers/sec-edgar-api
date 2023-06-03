import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveExpenseOperating(report: ReportWrapper): void {
	const { expenseOperating, revenueTotal, revenueCost, incomeOperating } = report as ExcludeNulls<typeof report>
	const nullKey = getSingleNullKey({ expenseOperating, revenueTotal, revenueCost, incomeOperating })

	switch (nullKey) {
		case 'expenseOperating':
			report.expenseOperating = revenueTotal - incomeOperating - revenueCost
			break

		case 'incomeOperating':
			report.incomeOperating = revenueTotal - revenueCost - expenseOperating
			break

		case 'revenueCost':
			report.revenueCost = revenueTotal - incomeOperating - expenseOperating
			break

		case 'revenueTotal':
			report.revenueTotal = incomeOperating + expenseOperating + revenueCost
	}
}

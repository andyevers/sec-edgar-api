import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveRevenueTotal(report: ReportWrapper): void {
	const { revenueTotal, revenueCost, profitGross } = report as ExcludeNulls<typeof report>
	const nullKey = getSingleNullKey({ revenueTotal, revenueCost, profitGross })

	switch (nullKey) {
		case 'revenueTotal':
			report.revenueTotal = revenueCost + profitGross
			break

		case 'revenueCost':
			report.revenueCost = revenueTotal - profitGross
			break

		case 'profitGross':
			report.profitGross = revenueTotal - revenueCost
			break
	}
}

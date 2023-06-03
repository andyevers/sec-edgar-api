import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveLiabilityCurrent(report: ReportWrapper): void {
	const { liabilityCurrent, liabilityNonCurrent, liabilityTotal } = report as ExcludeNulls<typeof report>
	const nullKey = getSingleNullKey({ liabilityCurrent, liabilityNonCurrent, liabilityTotal })

	switch (nullKey) {
		case 'liabilityCurrent':
			report.liabilityCurrent = liabilityTotal - liabilityNonCurrent
			break

		case 'liabilityNonCurrent':
			report.liabilityNonCurrent = liabilityTotal - liabilityCurrent
			break

		case 'liabilityTotal':
			report.liabilityTotal = liabilityCurrent + liabilityNonCurrent
			break
	}
}

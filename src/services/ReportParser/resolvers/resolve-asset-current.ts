import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveAssetCurrent(report: ReportWrapper): void {
	const { assetCurrent, assetNonCurrent, assetTotal } = report as ExcludeNulls<typeof report>
	const nullKey = getSingleNullKey({ assetCurrent, assetNonCurrent, assetTotal })

	switch (nullKey) {
		case 'assetCurrent':
			report.assetCurrent = assetTotal - assetNonCurrent
			break

		case 'assetNonCurrent':
			report.assetNonCurrent = assetTotal - assetCurrent
			break

		case 'assetTotal':
			report.assetTotal = assetCurrent + assetNonCurrent
			break
	}
}

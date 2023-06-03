import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveAssetNonCurrentPPEGross(report: ReportWrapper): void {
	const { expenseDepreciationAccumulated, assetNonCurrentPPEGross, assetNonCurrentPPENet } = report as ExcludeNulls<
		typeof report
	>
	const nullKey = getSingleNullKey({ expenseDepreciationAccumulated, assetNonCurrentPPEGross, assetNonCurrentPPENet })

	switch (nullKey) {
		case 'assetNonCurrentPPEGross':
			report.assetNonCurrentPPEGross = assetNonCurrentPPENet + expenseDepreciationAccumulated
			break

		case 'assetNonCurrentPPENet':
			report.assetNonCurrentPPENet = assetNonCurrentPPEGross - expenseDepreciationAccumulated
			break

		case 'expenseDepreciationAccumulated':
			report.expenseDepreciationAccumulated = assetNonCurrentPPEGross - assetNonCurrentPPENet
			break
	}
}

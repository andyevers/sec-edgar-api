import ReportWrapper from '../ReportWrapper'
import { ExcludeNulls, getSingleNullKey } from './helpers'

export function resolveEbit(report: ReportWrapper): void {
	if (report.incomeOperating) {
		report.ebit = report.incomeOperating
		return
	}

	const { ebit, expenseDepreciation, ebitda } = report as ExcludeNulls<typeof report>
	const nullKey = getSingleNullKey({ ebit, expenseDepreciation, ebitda })

	switch (nullKey) {
		case 'ebit':
			report.ebit = expenseDepreciation + ebitda
			break

		case 'ebitda':
			report.ebitda = ebit - expenseDepreciation
			break

		case 'expenseDepreciation':
			report.expenseDepreciation = ebit - ebitda
			break
	}

	report.incomeOperating = report.ebit
}

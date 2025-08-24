import type { FactItem } from './company-facts.type'

export interface XMLParams {
	xml: string
}

export interface CompanyTickerItem {
	cik_str: number
	ticker: string
	title: string
}

export interface FieldDataResponse<Field extends string = string> {
	fields: Field[]
	data: (string | number)[][]
}

export interface SplitData {
	/** The filed date of the report in which the split was first filed */
	filedFirst: string
	/** The filed date of the report in which the split was last filed */
	filedLast: string
	/** The period end date of the report in which the split was first filed */
	endFirst: string
	/** The period end date of the report in which the split was last filed */
	endLast: string
	/** ex: forward split 1:20 = 20, reverse split 20:1 = 0.05 */
	splitRatio: number
}
export interface FactGroup {
	name: string
	unit: string
	accn: string
	reportEnd: string
	reportFiled: string
	isResolverGenerated: boolean
	filedFirst: string
	filedLast: string
	endFirst: string
	endLast: string
	values: (number | string)[]
	fiscalYear: number
	quarter: number
	facts: FactItem[]
	valueSplitAdjustedPeriod: number | string | null
	valueSplitAdjustedTrailing: number | string | null
	valuePeriodResolved: number | string | null
	valueTrailingResolved: number | string | null
	valuePeriodFirst: number | string | null
	valuePeriodLast: number | string | null
	valueTrailingFirst: number | string | null
	valueTrailingLast: number | string | null
}

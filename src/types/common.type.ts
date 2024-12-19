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
	filedFirst: string
	filedLast: string
	endFirst: string
	endLast: string
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

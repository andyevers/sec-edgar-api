import { FactItem } from './company-facts.type'

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
	values: number[]
	fiscalYear: number
	quarter: number
	facts: FactItem[]
	valueSplitAdjustedPeriod: number | null
	valueSplitAdjustedTrailing: number | null
	valuePeriodResolved: number | null
	valueTrailingResolved: number | null
	valuePeriodFirst: number | null
	valuePeriodLast: number | null
	valueTrailingFirst: number | null
	valueTrailingLast: number | null
}

export interface FactItemExtended extends FactItem {
	period: number
	year: number
	quarter: number
	periodValue: number | null
	trailingValue: number | null
	splitValue: number | null
	splitsApplied: number[]
}

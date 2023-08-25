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

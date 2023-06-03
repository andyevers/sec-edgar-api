// items from companyfacts.zip download
export interface CompanyFactListData {
	cik: number
	entityName: string
	facts: CompanyFactList
}

export interface CompanyFactList {
	dei: Record<string, CompanyFact>
	invest?: Record<string, CompanyFact>
	'us-gaap'?: Record<string, CompanyFact>
}

export interface CompanyFact {
	label: string
	description: string
	units: Record<string, FactValue[]>
}

export interface FactValue {
	start?: string
	end: string
	val: number
	accn: string
	fy?: number
	fp: string
	form: string
	filed: string
	frame?: string
}

export interface CompanyFactFrame {
	cik: number
	taxonomy: string
	tag: string
	label: string
	description: string
	entityName: string
	units: Record<string, FactValue[]>
}

export interface MultiCompanyFactFrameItem {
	accn: string
	cik: number
	entityName: string
	loc: string
	end: string
	val: number
}

export interface MultiCompanyFactFrame {
	taxonomy: string
	tag: string
	ccp: string
	uom: string
	label: string
	description: string
	pts: number
	data: MultiCompanyFactFrameItem[]
}

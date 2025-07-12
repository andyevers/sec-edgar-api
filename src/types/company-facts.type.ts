import type { FiscalPeriod } from './report-raw.type'

// items from companyfacts.zip download
export interface CompanyFactListData {
	cik: number
	entityName: string
	facts: CompanyFactList
}

export interface CompanyFactList {
	dei: Record<string, CompanyFact>
	invest?: Record<string, CompanyFact>
	srt?: Record<string, CompanyFact>
	'us-gaap'?: Record<string, CompanyFact>
}

export interface CompanyFact {
	label: string | null
	description: string | null
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

export interface FactItem {
	cik: number | string
	end: string
	filed: string
	name: string
	unit: string
	value: number | string
	start?: string
	hasSegments?: boolean
	accn?: string
	form?: string
	fp?: string
	frame?: string
	fy?: number
	/** For XBRL reports only */
	segments?: { value: string; dimension: string }[]
	uuid?: string
}

export interface FactItemExtended extends FactItem {
	isUsedInReport?: boolean
	isCurrentPeriod?: boolean
	decimals?: number
	scale?: number
	contextRef: string
	label: string
	period: number
	quarter: number
	fiscalYear: number
}

export interface FactItemWithFiscals extends FactItem {
	fiscalPeriod: FiscalPeriod
	year: number
}

import type { InsiderTransactionExtended } from './insider-transaction.type'

export interface InstitutionalHolder {
	name: string
	origin: string
	shares: number
	percentOfClass: string
	votingPowerSole: string | null
	votingPowerShared: string | null
	dispositivePowerSole: string | null
	dispositivePowerShared: string | null
	typeOfReportingPerson: string | null
}

export interface TableData {
	title: string
	textBefore: string | null
	textAfter: string | null
	hasHeader: boolean
	sectionIndex: number
	rows: (string | number | null)[][]
}

export interface ExecutiveCompensation {
	name: string
	position: string | null
	year: number | null
	salaryDollars: number | null
	bonusDollars: number | null
	stockAwardDollars: number | null
	nonEquityDollars: number | null
	otherDollars: number | null
	totalDollars: number | null
}

export interface Holder {
	name: string
	position: string | null
	shares: number | null
	percentOfClass: string | null
}

// FORM DATA

export interface Form4Data {
	transactions: InsiderTransactionExtended[]
}

export interface Form10KData {
	tables: TableData[]
}

export interface Form13GData {
	holders: InstitutionalHolder[]
}

export interface FormDef14aData {
	executiveCompensation: ExecutiveCompensation[]
	holders: Holder[]
}

export type DailyFilingFormType = '10-K' | '10-Q' | '8-K' | '14' | '485' | 'S-8' | 'ALL'

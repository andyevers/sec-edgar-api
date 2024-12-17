interface TransactionDescriptionByCode {
	S: 'Sale'
	V: 'Voluntary Reporting'
	A: 'Grant'
	D: 'Sale to Issuer'
	F: 'Payment of Exercise Price'
	I: 'Discretionary Transaction'
	M: 'Conversion of Derivative Exempt'
	C: 'Conversion of Derivative'
	E: 'Expiration of Short Derivative Position'
	H: 'Expiration of Long Derivative Position'
	O: 'Exercise of out-of-the-money Derivative'
	X: 'Exercise of in-the-money Derivative'
	G: 'Gift'
	L: 'Small Acquisition'
	W: 'Acquisition or Disposition By Will or Laws'
	Z: 'Voting Trust Deposit or Withdrawal'
	J: 'Other Acquisition or Disposition'
	K: 'Equity Swap'
	U: 'Disposition Change in Control'
}

export type TransactionType = 'Acquire' | 'Dispose'
export type TransactionCode = keyof TransactionDescriptionByCode
export type TransactionDescription = TransactionDescriptionByCode[TransactionCode]

export interface InsiderTransactionExtended {
	filerName: string
	filerPosition: string
	filerPositionTypes: string[]
	securityType: string
	securityTypeUnderlying: string | null
	category: 'Derivative' | 'Non-Derivative'
	date: string
	dateExecuted: string | null
	dateExpiration: string | null
	dateExercisable: string | null
	transactionDescription: string | null
	transactionCode: TransactionCode | null
	transactionType: TransactionType | null
	sharesEnding: number | null
	shares: number | null
	sharesUnderlying: number | null
	price: number | null
	priceExcercised: number | null
	ownership: string
	explainationByKey: Partial<Record<keyof InsiderTransactionExtended, string>>
}

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

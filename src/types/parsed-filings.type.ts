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

export interface InsiderTransaction {
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
	explainationByKey: Partial<Record<keyof InsiderTransaction, string>>
}

export interface Holder {
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

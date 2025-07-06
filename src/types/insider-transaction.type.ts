export type TransactionCode =
	| 'S'
	| 'V'
	| 'A'
	| 'D'
	| 'F'
	| 'I'
	| 'M'
	| 'C'
	| 'E'
	| 'H'
	| 'O'
	| 'X'
	| 'G'
	| 'L'
	| 'W'
	| 'Z'
	| 'J'
	| 'K'
	| 'U'

export interface Owner {
	ownerName: string
	ownerCik: number
	ownerPosition: string | null
	isDirector: boolean
	isOfficer: boolean
	isTenPercentOwner: boolean
}

export interface Issuer {
	issuerName: string
	issuerCik: number
}

export interface InsiderTransaction {
	ownerName: string
	ownerCik: number
	ownerPosition: string | null
	isTenPercentOwner: boolean

	issuerCik: number
	issuerName: string

	isDirector: boolean
	isOfficer: boolean

	/** true = buy, false = sell */
	isAcquisition: boolean
	isDirectOwnership: boolean
	securityTitle: string
	transactionDate: string
	/**
	 * ### Transaction Codes
	 * - P: Purchase
	 * - S: Sale
	 * - V: Voluntary Reporting
	 * - A: Grant
	 * - D: Sale to Issuer
	 * - F: Payment of Exercise Price
	 * - I: Discretionary Transaction
	 * - M: Conversion of Derivative Exempt
	 * - C: Conversion of Derivative
	 * - E: Expiration of Short Derivative Position
	 * - H: Expiration of Long Derivative Position
	 * - O: Exercise of out-of-the-money Derivative
	 * - X: Exercise of in-the-money Derivative
	 * - G: Gift
	 * - L: Small Acquisition
	 * - W: Acquisition or Disposition By Will or Laws
	 * - Z: Voting Trust Deposit or Withdrawal
	 * - J: Other Acquisition or Disposition
	 * - K: Equity Swap
	 * - U: Disposition Change in Control
	 */
	transactionCode: TransactionCode
	transactionShares: number
	sharesOwnedFollowingTransaction: number
	lineNumber: number
	deemedExecutionDate: string
	form: string
	accessionNumber: string
}

export type TransactionType = 'Acquire' | 'Dispose'

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

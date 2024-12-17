export interface Owner {
	ownerName: string
	ownerCik: number
	ownerPosition: string | null
	isDirector: boolean
	isOfficer: boolean
}

export interface Issuer {
	issuerName: string
	issuerCik: number
}

export interface InsiderTransaction {
	ownerName: string
	ownerCik: number
	ownerPosition: string | null

	issuerCik: number
	issuerName: string

	isDirector: boolean
	isOfficer: boolean

	/** true = buy, false = sell */
	isAcquisition: boolean
	isDirectOwnership: boolean
	securityTitle: string
	transactionDate: string
	transactionCode: string
	transactionShares: number
	sharesOwnedFollowingTransaction: number
	lineNumber: number
	deemedExecutionDate: string
	form: string
	accessionNumber: string
}

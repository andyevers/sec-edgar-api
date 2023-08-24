interface Address {
	street1: string
	street2: string | null
	city: string
	stateOrCountry: string
	zipCode: string
	stateOrCountryDescription: string
}

interface AddressList {
	mailing: Address
	business: Address
}

interface FormerNameData {
	name: string
	from: string
	to: string
}

interface FileData {
	name: string
	filingCount: number
	filingFrom: string
	filingTo: string
}

export interface FilingListDetails {
	accessionNumber: string[]
	filingDate: string[]
	reportDate: string[]
	acceptanceDateTime: string[]
	act: string[]
	form: string[]
	fileNumber: string[]
	filmNumber: string[]
	items: string[]
	size: number[]
	isXBRL: number[]
	isInlineXBRL: number[]
	primaryDocument: string[]
	primaryDocDescription: string[]
}

export interface FilingListItemTranslated {
	accessionNumber: string
	filingDate: string
	reportDate: string
	acceptanceDateTime: string
	act: string
	form: string
	fileNumber: string
	filmNumber: string
	items: string
	size: number
	isXBRL: number
	isInlineXBRL: number
	primaryDocument: string
	primaryDocDescription: string
	url: string
}

interface FilingList {
	recent: FilingListDetails
	files: FileData[]
	recentTranslated?: FilingListItemTranslated[]
}

export interface SubmissionList {
	cik: number
	entityType: string
	sic: string
	sicDescription: string
	/** 1 or 0 */
	insiderTransactionForOwnerExists: number
	/** 1 or 0 */
	insiderTransactionForIssuerExists: number
	name: string
	tickers: string[]
	exchanges: string[]
	ein: string
	description: string
	website: string
	investorWebsite: string
	category: string
	fiscalYearEnd: string
	stateOfIncorporation: string
	stateOfIncorporationDescription: string
	addresses: AddressList
	phone: string
	flags: string
	formerNames: FormerNameData[]
	filings: FilingList
}

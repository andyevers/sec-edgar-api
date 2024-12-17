export interface CurrentFilingEntry {
	title: string
	link: string
	filingDate: string
	accessionNumber: string
	size: string
	updated: string
	form: string
	url: string
	cik: number
}

export interface CurrentFilingsList {
	title: string
	id: string
	updated: string
	entries: CurrentFilingEntry[]
}

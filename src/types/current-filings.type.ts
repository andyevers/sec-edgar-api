export interface CurrentFilingsXBRL {
	title: string
	link: string
	description: string
	language: string
	pubDate: string
	lastBuildDate: string
	items: FilingItemXBRL[]
}

export interface FilingItemXBRL {
	title: string
	link: string
	guid: string
	url: string
	enclosureUrl: string
	enclosureLength: number
	enclosureType: string
	pubDate: string
	description: string
	companyName: string
	formType: string
	filingDate: string
	cikNumber: number
	accessionNumber: string
	fileNumber: string
	acceptanceDatetime: string
	period: string
	assistantDirector: string
	assignedSic: number
	fiscalYearEnd: string
	files: FilingItemXBRLFile[]
}

export interface FilingItemXBRLFile {
	sequence: number
	file: string
	type: string
	size: number
	description: string
	url: string
	inlineXBRL: boolean
}

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

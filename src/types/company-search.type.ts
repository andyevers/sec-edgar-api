export interface CompanySearchResult {
	cik: number
	sic: number | null
	sicDescription: string | null
	companyName: string
	stateOrCountry: string | null
}

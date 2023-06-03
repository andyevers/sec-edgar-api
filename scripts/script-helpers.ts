import { CompanyFactListData } from '../src/types'
import { factFileReader, reportParser } from '../src'

export function readAllCompanyFactFiles(companyFactsDirname: string, limit?: number): CompanyFactListData[] {
	const symbols = Object.keys(factFileReader.getCikBySymbol())
	const companyFactsList: CompanyFactListData[] = []

	for (let i = 0; i < (limit ?? symbols.length); i++) {
		try {
			const symbol = symbols[i]
			const companyFacts = factFileReader.readFactFile({ symbol, companyFactsDirname })
			companyFactsList.push(companyFacts)
		} catch (e) {
			continue
		}
	}

	return companyFactsList
}

export function getPropertyUsageCounts(companyFactsList: CompanyFactListData[], sortAlphabetically = false) {
	const propertyNameUsageCounts = new Map<string, number>()
	for (const companyFacts of companyFactsList) {
		for (const report of reportParser.parseReportsRawNoMeta(companyFacts)) {
			for (const propertyName in report) {
				propertyNameUsageCounts.set(propertyName, (propertyNameUsageCounts.get(propertyName) ?? 0) + 1)
			}
		}
	}

	const entriesSorted = sortAlphabetically
		? Array.from(propertyNameUsageCounts.entries()).sort((a, b) => b[1] - a[1])
		: Array.from(propertyNameUsageCounts.entries()).sort((a, b) => (b[0] > a[0] ? 1 : -1))

	return Object.fromEntries(entriesSorted)
}

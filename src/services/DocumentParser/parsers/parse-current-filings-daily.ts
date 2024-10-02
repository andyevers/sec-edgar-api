import { XMLParams } from '../../../types'

export function parseCurrentFilingsDaily(params: XMLParams) {
	const { xml } = params
	const csv = xml.split('<hr>')[1] ?? ''
	const lines = csv.split('\n').slice(0, -1)

	const [matchHtml = '', totalHtml = ''] = xml.match(/<strong>.{1,20}?<\/strong>/g) ?? []

	const date = xml.split('of matches for')?.[1].split('is', 1)?.[0]?.trim()
	const matchCount = Number(matchHtml.split('>')[1]?.split('<')[0]?.trim()) || 0
	const totalCount = Number(totalHtml.split('>')[1]?.split('<')[0]?.trim()) || 0

	const entries = lines.map((line) => {
		const parts = line.split('<a ')

		const partDate = parts[0] ?? ''
		const partNameCik = parts[parts.length - 1] ?? ''
		const partAccessionForm = (parts[1] ?? '').split('/Archives/edgar/data/')[1]?.split('/')?.[1] ?? ''

		const partNameCikParts = partNameCik.split('</a>')
		const [accession, formUnfiltered] = partAccessionForm?.split('>') ?? []

		const accessionNumber = (accession?.substring(0, accession.lastIndexOf('-')) ?? '').trim()
		const form = (formUnfiltered?.replace(/</g, '') ?? '').trim()
		const companyCik = Number(partNameCikParts[0]?.split('>')[1]?.trim() ?? '')
		const companyName = partNameCikParts[1]?.trim() ?? ''
		const filedDate = partDate.trim() ?? ''

		const [month, day, year] = filedDate.split('-')

		return {
			accessionNumber,
			form,
			companyCik,
			companyName,
			filedDate: `${year}-${month}-${day}`,
		}
	})

	return { date, matchCount, totalCount, entries }
}

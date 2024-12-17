import { CurrentFilingEntry, CurrentFilingsList, XMLParams } from '../../../types'

export function parseCurrentFilings(params: XMLParams): CurrentFilingsList {
	const { xml } = params

	const indexTitle = xml.indexOf('<title>') + 7
	const indexTitleEnd = xml.indexOf('</title>', indexTitle)

	const indexId = xml.indexOf('<id>', indexTitleEnd + 8) + 4
	const indexIdEnd = xml.indexOf('</id>', indexId)

	const indexUpdated = xml.indexOf('<updated>', indexIdEnd + 5) + 9
	const indexUpdatedEnd = xml.indexOf('</updated>', indexUpdated)

	const indexEntries = xml.indexOf('<entry>', indexUpdatedEnd + 10)

	const title = xml.substring(indexTitle, indexTitleEnd)
	const id = xml.substring(indexId, indexIdEnd)
	const updated = xml.substring(indexUpdated, indexUpdatedEnd)

	// Entry example:
	// <title>10-K - Galaxy Enterprises Inc. /WY/ (0001871890) (Filer)</title>
	// <link rel="alternate" type="text/html" href="https://www.sec.gov/Archives/edgar/data/1871890/000139390524000423/0001393905-24-000423-index.htm"/>
	// <summary type="html">
	//  &lt;b&gt;Filed:&lt;/b&gt; 2024-12-13 &lt;b&gt;AccNo:&lt;/b&gt; 0001393905-24-000423 &lt;b&gt;Size:&lt;/b&gt; 1 MB
	// </summary>
	// <updated>2024-12-13T15:51:46-05:00</updated>
	// <category scheme="https://www.sec.gov/" label="form type" term="10-K"/>
	// <id>urn:tag:sec.gov,2008:accession-number=0001393905-24-000423</id>
	// </entry>
	const entries: CurrentFilingEntry[] = []
	for (let i = indexEntries; i < xml.length; i++) {
		const entryTitle = xml.indexOf('<title>', i) + 7
		const entryTitleEnd = xml.indexOf('</title>', entryTitle)

		const entryLink = xml.indexOf('href="', entryTitleEnd) + 6
		const entryLinkEnd = xml.indexOf('"', entryLink)

		const entryFiled = xml.indexOf('&gt; ', entryLinkEnd) + 5
		const entryFiledEnd = xml.indexOf(' &lt;', entryFiled)

		const entryAccNo = xml.indexOf('AccNo:&lt;/b&gt; ', entryFiledEnd) + 17
		const entryAccNoEnd = xml.indexOf(' &lt;', entryAccNo)

		const entrySize = xml.indexOf('Size:&lt;/b&gt; ', entryAccNoEnd) + 16
		const entrySizeEnd = xml.indexOf('\n', entrySize)

		const entryUpdated = xml.indexOf('<updated>', entrySizeEnd) + 9
		const entryUpdatedEnd = xml.indexOf('</updated>', entryUpdated)

		const entryForm = xml.indexOf('term="', entryUpdatedEnd) + 6
		const entryFormEnd = xml.indexOf('"', entryForm)
		i = xml.indexOf('<entry>', entryFormEnd)

		const title = xml.substring(entryTitle, entryTitleEnd)
		const link = xml.substring(entryLink, entryLinkEnd)
		const filingDate = xml.substring(entryFiled, entryFiledEnd)
		const accessionNumber = xml.substring(entryAccNo, entryAccNoEnd)
		const size = xml.substring(entrySize, entrySizeEnd)
		const updated = xml.substring(entryUpdated, entryUpdatedEnd)
		const form = xml.substring(entryForm, entryFormEnd)
		const url = `${link.substring(0, link.lastIndexOf('/'))}/${accessionNumber}.txt`

		const cikStart = link.indexOf('data/') + 5
		const cikEnd = link.indexOf('/', cikStart)
		const cik = Number(link.substring(cikStart, cikEnd)) || 0

		entries.push({
			title,
			cik,
			link,
			accessionNumber,
			filingDate,
			form,
			size,
			updated,
			url,
		})

		if (i === -1) {
			break
		}
	}

	return {
		title,
		id,
		updated,
		entries,
	}
}

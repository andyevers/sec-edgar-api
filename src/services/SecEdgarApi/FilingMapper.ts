import type { FilingListDetails, FilingListItemTranslated } from '../../types'

export default class FilingMapper {
	public mapFilingListDetails(cik: string | number, filingListDetails: FilingListDetails) {
		const filings: FilingListItemTranslated[] = []

		const accessionNumbers = filingListDetails.accessionNumber

		for (let i = 0; i < accessionNumbers.length; i++) {
			const accessionStrTrimmed = accessionNumbers[i]?.replace(/-/g, '')
			const urlPrefix = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionStrTrimmed}`

			const filing: FilingListItemTranslated = {
				accessionNumber: accessionNumbers[i],
				filingDate: filingListDetails.filingDate[i],
				reportDate: filingListDetails.reportDate[i],
				acceptanceDateTime: filingListDetails.acceptanceDateTime[i],
				act: filingListDetails.act[i],
				form: filingListDetails.form[i],
				fileNumber: filingListDetails.fileNumber[i],
				filmNumber: filingListDetails.filmNumber[i],
				items: filingListDetails.items[i],
				size: filingListDetails.size[i],
				isXBRL: filingListDetails.isXBRL[i],
				isInlineXBRL: filingListDetails.isInlineXBRL[i],
				primaryDocument: filingListDetails.primaryDocument[i],
				primaryDocDescription: filingListDetails.primaryDocDescription[i],
				url: `${urlPrefix}/${accessionNumbers[i]}.txt`,
				urlPrimaryDocument: `${urlPrefix}/${filingListDetails.primaryDocument[i]}`,
			}

			filings.push(filing)
		}

		return filings
	}
}

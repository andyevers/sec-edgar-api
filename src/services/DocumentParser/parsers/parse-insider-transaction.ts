import { Owner, InsiderTransaction, TransactionCode, Issuer, XMLParams } from '../../../types'

function parseTable(html: string) {
	const rows = html.split('<tr')
	return rows
		.map((rowHtml) =>
			rowHtml
				.split('<td')
				.map((cellHtml) => cellHtml.substring(cellHtml.indexOf('>') + 1, cellHtml.lastIndexOf('</td>')))
				.slice(1),
		)
		.filter((row) => row.length > 0)
}

function stripHtml(html: string) {
	return html
		.replace(/<.*?>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\n/g, ' ')
		.replace(/\s+/, ' ')
		.trim()
}

function toNumber(value: string): number {
	return Number(value.replace(/,/g, '').trim()) || 0
}

export function parseInsiderTransactions(params: XMLParams) {
	const { xml } = params

	const ownerTableHeadingIndex = xml.indexOf('sortid=')
	const transactionTableIdIndex = xml.indexOf('id="transaction-report"')

	if (ownerTableHeadingIndex === -1) {
		throw new Error('Owner table heading not found in XML data')
	}
	const ownerTableStartIndex = xml.lastIndexOf('<table', ownerTableHeadingIndex)
	const ownerTableEndIndex = xml.indexOf('</table>', ownerTableHeadingIndex) + 8
	const ownerTableHtml = xml.substring(ownerTableStartIndex, ownerTableEndIndex)

	const transactionTableStartIndex = xml.lastIndexOf('<table', transactionTableIdIndex)
	const transactionTableEndIndex = xml.indexOf('</table>', transactionTableIdIndex) + 8
	const transactionTableHtml = xml.substring(transactionTableStartIndex, transactionTableEndIndex)

	const issuerUrlIndex = xml.indexOf('cgi-bin/browse-edgar?action=getcompany')
	const issuerUrlStartIndex = xml.lastIndexOf('<b>', issuerUrlIndex) + 3
	const issuerUrlEndIndex = xml.indexOf('</b>', issuerUrlIndex)

	const issuerHtml = xml.substring(issuerUrlStartIndex, issuerUrlEndIndex).trim()
	const issuerHtmlCikStart = issuerHtml.lastIndexOf('(') + 1

	const issuerCik = toNumber(stripHtml(issuerHtml.substring(issuerHtmlCikStart, issuerHtml.lastIndexOf(')'))))
	const issuerName = issuerHtml.substring(0, issuerHtmlCikStart - 1).trim()

	const headerOwner = ['owner_name', 'filings', 'transaction_date', 'type_of_owner']

	const headerTransaction = [
		'acquisition_or_disposition',
		'transaction_date',
		'deemed_execution_date',
		'reporting_owner',
		'form',
		'transaction_type',
		'direct_or_indirect_ownership',
		'num_securities_transacted',
		'num_securities_following',
		'line_number',
		'owner_cik',
		'security_title',
	]

	const ownerByCik = new Map<number, Owner>()

	const ownerRows = parseTable(ownerTableHtml)
	const transactionRows = parseTable(transactionTableHtml)

	const isSwitchedOwnerIssuer = stripHtml(ownerRows[0]?.[0]?.toLowerCase()).includes('issuer') || false

	for (let i = 1; i < ownerRows.length; i++) {
		const row = ownerRows[i]
		// if (row.length === 0 || row[0].includes('Owner Name') || row[0].includes('Issuer')) continue // Skip header row
		const owner: Owner = {
			ownerName: '',
			ownerCik: 0,
			ownerPosition: null,
			isDirector: false,
			isOfficer: false,
			isTenPercentOwner: false,
		}

		for (let i = 0; i < row.length; i++) {
			const colName = headerOwner[i]
			const htmlStripped = stripHtml(row[i])

			switch (colName) {
				case 'owner_name':
					owner.ownerName = htmlStripped.split('Current Name')[0]
					break
				case 'filings':
					owner.ownerCik = toNumber(htmlStripped)
					break
				case 'type_of_owner': {
					const [ownerType, position = null] = htmlStripped.split(':').map((s) => s.toLowerCase().trim())
					owner.isDirector = ownerType.includes('director')
					owner.isOfficer = ownerType.includes('officer')
					owner.isTenPercentOwner = ownerType.includes('10 percent') || ownerType.includes('10%')
					owner.ownerPosition = position
					break
				}
			}
		}

		ownerByCik.set(owner.ownerCik, owner)
	}

	const transactions: InsiderTransaction[] = []
	for (const row of transactionRows) {
		if (row.length === 0 || row[0].includes('Acquisition or Dis')) continue // Skip header row
		const transaction: InsiderTransaction = {
			ownerName: '',
			ownerCik: 0,
			ownerPosition: null,
			issuerCik,
			issuerName,
			isDirector: false,
			isOfficer: false,
			accessionNumber: '',
			deemedExecutionDate: '',
			form: '',
			/** true = buy, false = sell */
			isAcquisition: false,
			isDirectOwnership: false,
			securityTitle: '',
			transactionDate: '',
			transactionCode: '' as unknown as TransactionCode,
			transactionShares: 0,
			sharesOwnedFollowingTransaction: 0,
			lineNumber: 0,
			isTenPercentOwner: false,
		}

		for (let i = 0; i < row.length; i++) {
			const colName = headerTransaction[i]
			const html = row[i]
			const htmlStripped = stripHtml(html)

			switch (colName) {
				case 'acquisition_or_disposition':
					transaction.isAcquisition = String(htmlStripped).toLowerCase() === 'a'
					break
				case 'transaction_date':
					transaction.transactionDate = htmlStripped
					break
				case 'deemed_execution_date':
					transaction.deemedExecutionDate = htmlStripped
					break
				case 'reporting_owner':
					break
				case 'form': {
					const url = html.match(/href="([^"]+)"/)?.[1] ?? ''
					transaction.accessionNumber = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('-'))
					transaction.form = htmlStripped
					break
				}
				case 'transaction_type':
					transaction.transactionCode = htmlStripped.trim()[0] as TransactionCode
					break
				case 'direct_or_indirect_ownership':
					transaction.isDirectOwnership = htmlStripped.toLowerCase().includes('d')
					break
				case 'num_securities_transacted':
					transaction.transactionShares = toNumber(htmlStripped) || 0
					break
				case 'num_securities_following':
					transaction.sharesOwnedFollowingTransaction = toNumber(htmlStripped)
					break
				case 'line_number':
					transaction.lineNumber = toNumber(htmlStripped)
					break
				case 'owner_cik': {
					const owner = ownerByCik.get(toNumber(htmlStripped) || 0)
					if (owner) {
						transaction.ownerName = owner.ownerName
						transaction.ownerCik = owner.ownerCik
						transaction.ownerPosition = owner.ownerPosition
						transaction.isDirector = owner.isDirector
						transaction.isOfficer = owner.isOfficer
						transaction.isTenPercentOwner = owner.isTenPercentOwner
					}
					break
				}
				case 'security_title':
					transaction.securityTitle = htmlStripped
					break
			}
		}

		transactions.push(transaction)
	}

	let owners = Array.from(ownerByCik.values())
	let issuers: Issuer[] = [{ issuerName, issuerCik }]

	// if searching by person, owner and issuer data will be switched
	if (isSwitchedOwnerIssuer) {
		issuers = owners.map((owner) => ({
			issuerName: owner.ownerName,
			issuerCik: owner.ownerCik,
		}))
		owners = []

		transactions.forEach((transaction) => {
			const { issuerName, issuerCik, ownerName, ownerCik } = transaction
			transaction.issuerCik = ownerCik
			transaction.issuerName = ownerName
			transaction.ownerCik = issuerCik
			transaction.ownerName = issuerName
		})
	}

	return {
		transactions: transactions,
		owners: Array.from(ownerByCik.values()),
		issuers,
	}
}

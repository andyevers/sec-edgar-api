import type { InsiderTransaction, Issuer, Owner, XMLParams } from '../../../types'
import HtmlTableExtractor from '../../HtmlTableExtractor'
import { TableHTMLData } from '../../HtmlTableExtractor/HtmlTableExtractor'

export function parseInsiderTransactions(params: XMLParams) {
	const { xml } = params

	const parser = new HtmlTableExtractor()
	const tables = parser.extractTables(xml, {
		stripHtml: true,
		tagsToExclude: ['sup'],
		stripParenthesis: true,
		removeEmptyColumns: false,
		getHeaderRowIndex: (data) => {
			return data.rows.findIndex((row) => {
				const isNotEmptyRow = row.some(
					(cell) => cell.html.replace(/<.*?>/g, '').replace(/&.*?;/g, '').replace(/\s/g, '').length > 0,
				)
				return isNotEmptyRow
			})
		},
	})

	const getTableHeadHtml = (table: TableHTMLData) => {
		const match = table.html.replace(/\n/g, '').match(/<b>.*?<\/b>/g)
		const matches = Array.isArray(match) ? match : []
		return matches.find((match) => match.includes('<a')) ?? null
	}

	const tableCompany = tables.find(
		(table) => table.html.includes('cgi-bin/browse-edgar?action=getcompany') && getTableHeadHtml(table) !== null,
	)

	const tableCompanyHead = tableCompany ? getTableHeadHtml(tableCompany) || '' : ''
	const issuerCik = Number(tableCompanyHead.split('</a>')[0]?.split('>').pop()?.trim()) || 0
	const issuerName = tableCompanyHead.split('(')[0]?.split('>').pop()?.trim() || ''

	const cells = tableCompany?.rows.flat() ?? []
	cells.find((cell) => cell.html.toLowerCase().includes('<b'))

	const getHeaderRow = (table: TableHTMLData) => table.rows.find((row) => row.some((cell) => cell.isHeaderRowCell))
	const findTableWithCol = (colTextLower: string) =>
		tables.find((table) =>
			getHeaderRow(table)?.some((cell) => String(cell.valueParsed).toLowerCase().includes(colTextLower)),
		)

	const tableOwners = findTableWithCol('type of owner')
	const tableTransactions = findTableWithCol('security name')

	const stripHtml = (html: string) =>
		html
			.replace(/<.*?>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/\n/g, ' ')
			.replace(/\s+/, ' ')
			.trim()

	const ownerByCik = new Map<number, Owner>()

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

	for (const row of tableOwners?.rows ?? []) {
		if (row[0]?.isHeaderRowCell) continue

		const owner: Owner = {
			ownerName: '',
			ownerCik: 0,
			ownerPosition: null,
			isDirector: false,
			isOfficer: false,
		}

		for (const cell of row) {
			const colName = headerOwner[cell.colIndex]
			const htmlStripped = stripHtml(cell.html)

			switch (colName) {
				case 'owner_name':
					owner.ownerName = htmlStripped.split('Current Name')[0]
					break
				case 'filings':
					owner.ownerCik = Number(cell.valueParsed || 0) || 0
					break
				case 'type_of_owner': {
					const parts = htmlStripped.split(':')
					owner.isDirector = parts[0]?.toLowerCase().includes('director')
					owner.isOfficer = parts[0]?.toLowerCase().includes('officer')
					owner.ownerPosition = parts[1]?.trim() || null
					break
				}
			}
		}

		ownerByCik.set(owner.ownerCik, owner)
	}

	const transactions: InsiderTransaction[] = []

	for (const row of tableTransactions?.rows ?? []) {
		if (row[0]?.isHeaderRowCell) continue
		const transaction: InsiderTransaction = {
			ownerName: '',
			ownerCik: 0,
			ownerPosition: null,
			issuerCik,
			issuerName,
			isDirector: false,
			isOfficer: false,

			/** true = buy, false = sell */
			isAcquisition: false,
			isDirectOwnership: false,
			securityTitle: '',
			transactionDate: '',
			transactionCode: '',
			transactionShares: 0,
			sharesOwnedFollowingTransaction: 0,
			lineNumber: 0,
			deemedExecutionDate: '',
			form: '',
			accessionNumber: '',
		}

		for (const cell of row) {
			const colName = headerTransaction[cell.colIndex]
			const htmlStripped = stripHtml(cell.html)

			switch (colName) {
				case 'acquisition_or_disposition':
					transaction.isAcquisition = String(cell.valueParsed).toLowerCase() === 'a'
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
					const url = cell.html.match(/href="([^"]+)"/)?.[1] ?? ''
					transaction.accessionNumber = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('-'))
					transaction.form = htmlStripped
					break
				}
				case 'transaction_type':
					transaction.transactionCode = htmlStripped.trim()[0]
					break
				case 'direct_or_indirect_ownership':
					transaction.isDirectOwnership = htmlStripped.toLowerCase().includes('d')
					break
				case 'num_securities_transacted':
					transaction.transactionShares = Number(cell.valueParsed) || 0
					break
				case 'num_securities_following':
					transaction.sharesOwnedFollowingTransaction = Number(cell.valueParsed) || 0
					break
				case 'line_number':
					transaction.lineNumber = Number(cell.valueParsed) || 0
					break
				case 'owner_cik': {
					const owner = ownerByCik.get(Number(cell.valueParsed) || 0)
					if (owner) {
						transaction.ownerName = owner.ownerName
						transaction.ownerCik = owner.ownerCik
						transaction.ownerPosition = owner.ownerPosition
						transaction.isDirector = owner.isDirector
						transaction.isOfficer = owner.isOfficer
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

	const isSwitchedOwnerIssuer = tableTransactions?.rows?.some((r) =>
		r.some((c) => String(c.valueParsed).toLowerCase() === 'issuer'),
	)

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

	return { transactions, owners, issuers }
}

import { InsiderTransaction, TransactionCode, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

/**
 * Form 4 - Insider Transactions
 *
 * example at https://www.sec.gov/Archives/edgar/data/320193/000032019323000079/xslF345X05/wk-form4_1691533817.xml
 */
export function parseForm4(params: XMLParams, xmlParser = new XMLParser()): InsiderTransaction[] {
	const { xml } = params

	const textMap = xmlParser.getTableTextMap({ xml, parentPath: 'html.body' })

	const getTextBetween = (text: string, before: string, after?: string) => {
		const indexBefore = text.indexOf(before)
		const indexAfter = after ? text.indexOf(after, indexBefore) : text.length
		return text.substring(indexBefore + before.length, indexAfter).trim()
	}

	const relationText = textMap.get('2.1.3') ?? ''
	const filerNameText = textMap.get('2.1.1') ?? ''

	const filterNameText = getTextBetween(filerNameText, '1. Name and Address of Reporting Person*', '(Last)')

	const isDirector = relationText.substring(0, relationText.indexOf('Director')).includes('X')
	const isOwner10 = getTextBetween(relationText, 'Director', '10% Owner').includes('X')
	const isOfficer = getTextBetween(relationText, '10% Owner', 'Officer (give title below)').includes('X')
	const isOther = getTextBetween(relationText, 'Officer (give title below)', 'Other (specify below)').includes('X')
	const position = getTextBetween(relationText, 'Other (specify below)')

	const filerPositionTypes: string[] = []
	if (isDirector) filerPositionTypes.push('Director')
	if (isOwner10) filerPositionTypes.push('10% Owner')
	if (isOfficer) filerPositionTypes.push('Officer')
	if (isOther) filerPositionTypes.push('Other')

	const codeTranslations: Record<string, string> = {
		P: 'Purchase',
		S: 'Sale',
		V: 'Voluntary Reporting',
		A: 'Grant',
		D: 'Sale to Issuer',
		F: 'Payment of Exercise Price',
		I: 'Discretionary Transaction',
		M: 'Conversion of Derivative Exempt',
		C: 'Conversion of Derivative',
		E: 'Expiration of Short Derivative Position',
		H: 'Expiration of Long Derivative Position',
		O: 'Exercise of out-of-the-money Derivative',
		X: 'Exercise of in-the-money Derivative',
		G: 'Gift',
		L: 'Small Acquisition',
		W: 'Acquisition or Disposition By Will or Laws',
		Z: 'Voting Trust Deposit or Withdrawal',
		J: 'Other Acquisition or Disposition',
		K: 'Equity Swap',
		U: 'Disposition Change in Control',
	}

	const toDate = (str: string) => {
		if (str === '') return ''
		const [month, day, year] = str.split('/')
		return [month, day, year].some((x) => x === undefined) ? '' : `${year}-${month}-${day}`
	}
	const createTransaction = (): InsiderTransaction => ({
		filerName: filterNameText,
		filerPosition: position,
		filerPositionTypes,
		category: 'Non-Derivative',
		securityType: '',
		securityTypeUnderlying: null,
		date: '',
		dateExecuted: null,
		dateExpiration: null,
		dateExercisable: null,
		transactionType: null,
		transactionCode: null,
		transactionDescription: null,
		price: null,
		priceExcercised: null,
		shares: null,
		sharesUnderlying: null,
		sharesEnding: null,
		ownership: '',
		explainationByKey: {},
	})

	const getColText = (colKey: string) => {
		const text = textMap.get(colKey)?.replace(/\(\d+\)|\$/g, '')
		return text?.trim() ?? ''
	}

	const headingNonDerivative: (keyof InsiderTransaction | '')[] = [
		'securityType',
		'date',
		'dateExecuted',
		'transactionCode',
		'',
		'shares',
		'transactionType',
		'price',
		'sharesEnding',
		'ownership',
	]

	const headingDerivative: (keyof InsiderTransaction | '')[] = [
		'securityType',
		'priceExcercised',
		'date',
		'dateExecuted',
		'transactionCode',
		'',
		'shares',
		'shares',
		'dateExercisable',
		'dateExpiration',
		'securityTypeUnderlying',
		'sharesUnderlying',
		'price',
		'sharesEnding',
		'ownership',
	]

	const maxIterations = 10_000
	const transactions: InsiderTransaction[] = []

	transactionsNonDerivative: for (let row = 4; row < maxIterations; row++) {
		const transaction = createTransaction()
		transaction.category = 'Non-Derivative'

		// get all non-derivative transactions
		for (let col = 1; col < 11; col++) {
			const colName = (headingNonDerivative[col - 1] ?? '') as keyof InsiderTransaction | ''
			const colKey = `3.${row}.${col}`

			const text = getColText(colKey)
			const explanationNum = (textMap.get(colKey) ?? '').match(/(?<=\()\d+(?=\))/g)?.[0] ?? null
			const explanationText = explanationNum ? textMap.get(`5.${Number(explanationNum) + 1}.1`) ?? '' : null

			if (colName === '') continue
			if (explanationText !== null) transaction.explainationByKey[colName] = explanationText.trim()
			if (!textMap.has(colKey)) break transactionsNonDerivative

			switch (colName) {
				case 'transactionType':
					transaction.transactionType = text === 'A' ? 'Acquire' : 'Dispose'
					continue
				case 'transactionCode':
					transaction.transactionDescription = codeTranslations[text] ?? ''
					transaction.transactionCode = text as TransactionCode
					continue
				case 'date':
					transaction.date = toDate(text)
					continue
				case 'dateExecuted':
				case 'dateExercisable':
				case 'dateExpiration':
					transaction[colName] = toDate(text) || null
					continue
				case 'price':
				case 'shares':
				case 'sharesEnding':
					const valueNum = Number(text.replace(/,/g, ''))
					transaction[colName] = text === '' || isNaN(valueNum) ? null : valueNum
					continue
				default:
					transaction[colName as 'ownership' | 'securityType'] = text
			}
		}

		transactions.push(transaction)
	}

	transactionsDerivative: for (let row = 4; row < maxIterations; row++) {
		const transaction = createTransaction()
		transaction.category = 'Derivative'

		const textSharesAcquired = getColText(`4.${row}.6`)
		const textSharesDisposed = getColText(`4.${row}.7`)

		const sharesAcquired = Number(textSharesAcquired)
		const sharesDisposed = Number(textSharesDisposed)

		if (textSharesAcquired !== '' || textSharesDisposed !== '') {
			transaction.transactionType = sharesAcquired - sharesDisposed > 0 ? 'Acquire' : 'Dispose'
		}

		for (let col = 1; col < 16; col++) {
			const colName = (headingDerivative[col - 1] ?? '') as keyof InsiderTransaction | ''
			const colKey = `4.${row}.${col}`

			const text = (textMap.get(colKey) ?? '').replace(/\(\d+\)|\$/g, '').trim()
			const explanationNum = (textMap.get(colKey) ?? '').match(/(?<=\()\d+(?=\))/g)?.[0] ?? null
			const explanationText = explanationNum ? textMap.get(`5.${Number(explanationNum) + 1}.1`) ?? '' : null

			if (colName === '') continue
			if (explanationText !== null) transaction.explainationByKey[colName] = explanationText.trim()
			if (!textMap.has(colKey)) break transactionsDerivative

			switch (colName) {
				case 'transactionType':
					transaction.transactionType = text === 'A' ? 'Acquire' : 'Dispose'
					continue
				case 'transactionCode':
					transaction.transactionDescription = codeTranslations[text] ?? ''
					transaction.transactionCode = text as TransactionCode
					continue
				case 'dateExecuted':
				case 'dateExercisable':
				case 'dateExpiration':
					transaction[colName] = toDate(text) || null
					continue
				case 'price':
				case 'shares':
				case 'sharesUnderlying':
				case 'priceExcercised':
				case 'sharesEnding':
					if (colName === 'shares' && transaction.shares !== null) continue
					const valueNum = Number(text.replace(/,/g, ''))
					transaction[colName] = text === '' || isNaN(valueNum) ? null : valueNum
					continue
				default:
					transaction[colName as 'ownership' | 'securityType'] = text
			}
		}
		transactions.push(transaction)
	}

	return transactions
}

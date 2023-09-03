import DocumentParser from '../src/services/DocumentParser'
import { TableData } from '../src/types'
import { form10qXML } from './__fixtures__/form-10q'
import { form13gXML } from './__fixtures__/form-13g'
import { form4XML } from './__fixtures__/form-4'
import { formDef14aXML } from './__fixtures__/form-def14a'

describe('DocumentParser', () => {
	const documentParser = new DocumentParser()

	test('parseForm4', () => {
		const result = documentParser.parseForm4({ xml: form4XML }).transactions

		expect(result.length).toBe(4)
		expect(result[1].filerName).toBe("O'BRIEN DEIRDRE")
		expect(result[1].filerPosition).toBe('Senior Vice President')
		expect(result[1].filerPositionTypes).toEqual(['Officer'])
		expect(result[1].category).toBe('Non-Derivative')
		expect(result[1].securityType).toBe('Common Stock')
		expect(result[1].securityTypeUnderlying).toBe(null)
		expect(result[1].date).toBe('2023-08-05')
		expect(result[1].dateExecuted).toBe(null)
		expect(result[1].dateExercisable).toBe(null)
		expect(result[1].dateExpiration).toBe(null)
		expect(result[1].transactionType).toBe('Dispose')
		expect(result[1].transactionCode).toBe('F')
		expect(result[1].transactionDescription).toBe('Payment of Exercise Price')
		expect(result[1].price).toBe(181.99)
		expect(result[1].priceExcercised).toBe(null)
		expect(result[1].shares).toBe(16477)
		expect(result[1].sharesUnderlying).toBe(null)
		expect(result[1].sharesEnding).toBe(151864)
		expect(result[1].ownership).toBe('D')
		expect(result[1].explainationByKey).toEqual({
			securityType:
				'3. Shares withheld by Apple to satisfy tax withholding requirements on vesting of restricted stock units.',
		})

		expect(result[result.length - 1]).toEqual({
			filerName: "O'BRIEN DEIRDRE",
			filerPosition: 'Senior Vice President',
			filerPositionTypes: ['Officer'],
			category: 'Derivative',
			securityType: 'Restricted Stock Unit',
			securityTypeUnderlying: 'Common Stock',
			date: '08/05/2023',
			dateExecuted: null,
			dateExpiration: null,
			dateExercisable: null,
			transactionType: null,
			transactionCode: 'M',
			transactionDescription: 'Conversion of Derivative Exempt',
			price: null,
			priceExcercised: null,
			shares: 31896,
			sharesUnderlying: 31896,
			sharesEnding: 0,
			ownership: 'D',
			explainationByKey: {
				priceExcercised:
					'1. Each restricted stock unit ("RSU") represents the right to receive, at settlement, one share of common stock. This transaction represents the settlement of RSUs in shares of common stock on their scheduled vesting date.',
				dateExercisable:
					'6. This award was granted on February 5, 2019. 31,896 restricted stock units subject to the award vested on August 5, 2021, August 5, 2022 and August 5, 2023.',
				dateExpiration:
					'6. This award was granted on February 5, 2019. 31,896 restricted stock units subject to the award vested on August 5, 2021, August 5, 2022 and August 5, 2023.',
				price: '1. Each restricted stock unit ("RSU") represents the right to receive, at settlement, one share of common stock. This transaction represents the settlement of RSUs in shares of common stock on their scheduled vesting date.',
			},
		})
	})

	test('parseForm13g', () => {
		const result = documentParser.parseForm13g({ xml: form13gXML }).holders

		expect(result.length).toBe(7)
		expect(result[0].name).toBe('Warren E. Buffett')
		expect(result[0].origin).toBe('United States Citizen')
		expect(result[0].shares).toBe(915560382)
		expect(result[0].percentOfClass).toBe('5.8%')
		expect(result[0].votingPowerSole).toBe(null)
		expect(result[0].votingPowerShared).toBe('915,560,382 shares of Common Stock')
		expect(result[0].dispositivePowerSole).toBe(null)
		expect(result[0].dispositivePowerShared).toBe('915,560,382 shares of Common Stock')
		expect(result[0].typeOfReportingPerson).toBe('IN')
	})

	test('parseForm10k', () => {
		const result = documentParser.parseForm10k({ xml: form10qXML }).tables

		const statementOperations = result.find((table) => table.title.includes('OPERATIONS')) as TableData
		const statementBalance = result.find((table) => table.title.includes('BALANCE SHEETS')) as TableData

		expect(statementOperations.title).toContain('CONDENSED CONSOLIDATED STATEMENTS OF OPERATIONS')
		expect(statementOperations.sectionIndex).toBe(2)
		expect(statementOperations.hasHeader).toBe(true)
		expect(statementOperations.textBefore).toContain(
			'(In millions, except number of shares which are reflected in thousands and per share amounts)',
		)
		expect(statementOperations.textAfter).toContain(
			'See accompanying Notes to Condensed Consolidated Financial Statements',
		)
		expect(statementOperations.rows).toEqual([
			[
				null,
				'Three Months Ended July 1, 2023',
				'Three Months Ended June 25, 2022',
				'Nine Months Ended July 1, 2023',
				'Nine Months Ended June 25, 2022',
			],
			['Net sales:', null, null, null, null],
			['Products', 60584, 63355, 230901, 245241],
			['Services', 21213, 19604, 62886, 58941],
			['Total net sales', 81797, 82959, 293787, 304182],
			[null, null, null, null, null],
			['Cost of sales:', null, null, null, null],
			['Products', 39136, 41485, 146696, 155084],
			['Services', 6248, 5589, 18370, 16411],
			['Total cost of sales', 45384, 47074, 165066, 171495],
			['Gross margin', 36413, 35885, 128721, 132687],
			[null, null, null, null, null],
			['Operating expenses:', null, null, null, null],
			['Research and development', 7442, 6797, 22608, 19490],
			['Selling, general and administrative', 5973, 6012, 18781, 18654],
			['Total operating expenses', 13415, 12809, 41389, 38144],
			[null, null, null, null, null],
			['Operating income', 22998, 23076, 87332, 94543],
			['Other income/(expense), net', -265, -10, -594, -97],
			['Income before provision for income taxes', 22733, 23066, 86738, 94446],
			['Provision for income taxes', 2852, 3624, 12699, 15364],
			['Net income', 19881, 19442, 74039, 79082],
			[null, null, null, null, null],
			['Earnings per share:', null, null, null, null],
			['Basic', 1.27, 1.2, 4.69, 4.86],
			['Diluted', 1.26, 1.2, 4.67, 4.82],
			[null, null, null, null, null],
			['Shares used in computing earnings per share:', null, null, null, null],
			['Basic', 15697614, 16162945, 15792497, 16277824],
			['Diluted', 15775021, 16262203, 15859263, 16394937],
		])

		expect(statementBalance.title).toContain('CONDENSED CONSOLIDATED BALANCE SHEETS')
		expect(statementBalance.sectionIndex).toBe(4)
		expect(statementBalance.hasHeader).toBe(true)
		expect(statementBalance.textBefore).toContain(
			'(In millions, except number of shares which are reflected in thousands and par value)',
		)
		expect(statementBalance.textAfter).toContain(
			'See accompanying Notes to Condensed Consolidated Financial Statements',
		)
		expect(statementBalance.rows).toEqual([
			[null, 'July 1, 2023', 'September 24, 2022'],
			['Current assets:', null, null],
			['Cash and cash equivalents', 28408, 23646],
			['Marketable securities', 34074, 24658],
			['Accounts receivable, net', 19549, 28184],
			['Inventories', 7351, 4946],
			['Vendor non-trade receivables', 19637, 32748],
			['Other current assets', 13640, 21223],
			['Total current assets', 122659, 135405],
			[null, null, null],
			['Non-current assets:', null, null],
			['Marketable securities', 104061, 120805],
			['Property, plant and equipment, net', 43550, 42117],
			['Other non-current assets', 64768, 54428],
			['Total non-current assets', 212379, 217350],
			['Total assets', 335038, 352755],
			[null, null, null],
			['Current liabilities:', null, null],
			['Accounts payable', 46699, 64115],
			['Other current liabilities', 58897, 60845],
			['Deferred revenue', 8158, 7912],
			['Commercial paper', 3993, 9982],
			['Term debt', 7216, 11128],
			['Total current liabilities', 124963, 153982],
			[null, null, null],
			['Non-current liabilities:', null, null],
			['Term debt', 98071, 98959],
			['Other non-current liabilities', 51730, 49142],
			['Total non-current liabilities', 149801, 148101],
			['Total liabilities', 274764, 302083],
			[null, null, null],
			['Commitments and contingencies', null, null],
			[null, null, null],
			["Shareholders' equity:", null, null],
			[
				'Common stock and additional paid-in capital, $ 0.00001par value: 50,400,000shares authorized; 15,647,868and 15,943,425shares issued and outstanding, respectively',
				70667,
				64849,
			],
			['Retained earnings/(Accumulated deficit)', 1408, -3068],
			['Accumulated other comprehensive income/(loss)', -11801, -11109],
			["Total shareholders' equity", 60274, 50672],
			["Total liabilities and shareholders' equity", 335038, 352755],
		])
	})

	test('parseFormDef14a', () => {
		const { executiveCompensation, holders } = documentParser.parseFormDef14a({ xml: formDef14aXML })

		expect(executiveCompensation[0]).toEqual({
			name: 'Tim Cook',
			position: 'Chief Executive Officer',
			year: 2022,
			salaryDollars: 3000000,
			bonusDollars: null,
			stockAwardDollars: 82994164,
			nonEquityDollars: 12000000,
			otherDollars: 1425933,
			totalDollars: 99420097,
		})

		expect(executiveCompensation[executiveCompensation.length - 1]).toEqual({
			name: 'Jeff Williams',
			position: 'Chief Operating Officer',
			year: 2020,
			salaryDollars: 1000000,
			bonusDollars: null,
			stockAwardDollars: 21657687,
			nonEquityDollars: 3577000,
			otherDollars: 17137,
			totalDollars: 26251824,
		})

		expect(executiveCompensation.length).toBe(15)

		expect(holders[0]).toEqual({
			name: 'The Vanguard',
			position: null,
			shares: 1261261357,
			percentOfClass: '7.96%',
		})

		expect(holders).toContainEqual({
			name: 'Jeff Williams',
			position: null,
			shares: 677392,
			percentOfClass: '*',
		})

		expect(holders).toHaveLength(17)
	})
})

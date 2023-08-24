import DocumentParser from '../src/services/DocumentParser'
import { form13gXML } from './__fixtures__/form-13g'
import { form4XML } from './__fixtures__/form-4'

describe('DocumentParser', () => {
	const documentParser = new DocumentParser()

	test('parseInsiderTransactions', () => {
		const result = documentParser.parseInsiderTransactions({ xml: form4XML })

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

	test('parseHolders', () => {
		const result = documentParser.parseHolders({ xml: form13gXML })

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
})

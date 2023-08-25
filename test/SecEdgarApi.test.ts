import { IClient } from '../src/services/Client'
import { IThrottler } from '../src/services/SecEdgarApi/Throttler'
import SecEdgarApi from '../src/services/SecEdgarApi'
import ReportParser from '../src/services/ReportParser'
import DocumentParser from '../src/services/DocumentParser'

describe('SecEdgarApi', () => {
	const client: IClient = {
		request: () => new Promise((resolve) => resolve({ data: Buffer.from('{}'), message: '', statusCode: 200 })),
	}

	const reportParser = new ReportParser()
	const documentParser = new DocumentParser()

	const throttler: IThrottler = {
		add: (fn) => fn(),
		setDelayMs: () => null,
	}

	const cikBySymbol: Record<string, number> = {
		AAPL: 123,
	}

	const secEdgarApi = new SecEdgarApi({ cikBySymbol, throttler, client, reportParser, documentParser })

	test('getFact', async () => {
		const add = jest.spyOn(throttler, 'add')
		const request = jest.spyOn(client, 'request')
		await secEdgarApi.getFact({ symbol: 'AAPL', fact: 'NetIncomeLoss' })

		expect(add).toHaveBeenCalledTimes(1)
		expect(request).toBeCalledTimes(1)

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/api/xbrl/companyconcept/CIK0000000123/us-gaap/NetIncomeLoss.json',
			onError: expect.any(Function),
		})
	})

	test('getFacts', async () => {
		const request = jest.spyOn(client, 'request')
		await secEdgarApi.getFacts({ symbol: 'AAPL' })

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000123.json',
			onError: expect.any(Function),
		})
	})

	test('getSubmissions', async () => {
		const request = jest.spyOn(client, 'request')
		await secEdgarApi.getSubmissions({ symbol: 'AAPL' })

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/submissions/CIK0000000123.json',
			onError: expect.any(Function),
		})
	})

	test('getFactFrame', async () => {
		const request = jest.spyOn(client, 'request')
		await secEdgarApi.getFactFrame({ fact: 'AccountsPayable', taxonomy: 'dei', frame: 'CY2023Q3I', unit: 'USD' })

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/api/xbrl/frames/dei/AccountsPayable/USD/CY2023Q3I.json',
			onError: expect.any(Function),
		})
	})
})

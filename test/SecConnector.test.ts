import { IClient } from '../src/services/SecEdgarApi/Client'
import SecConnector from '../src/services/SecEdgarApi/SecConnector'
import { IThrottler } from '../src/services/SecEdgarApi/Throttler'

describe('SecConnector', () => {
	const client: IClient = {
		request: () => new Promise((resolve) => resolve({ data: Buffer.from('{}'), message: '', statusCode: 200 })),
	}

	const throttler: IThrottler = {
		add: (fn) => fn(),
		setDelayMs: () => null,
	}

	const cikBySymbol: Record<string, number> = {
		AAPL: 123,
	}

	const secConnector = new SecConnector({ cikBySymbol, throttler, client })

	test('getFact', async () => {
		const add = jest.spyOn(throttler, 'add')
		const request = jest.spyOn(client, 'request')
		await secConnector.getFact({ symbol: 'AAPL', fact: 'NetIncomeLoss' })

		expect(add).toHaveBeenCalledTimes(1)
		expect(request).toBeCalledTimes(1)

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/api/xbrl/companyconcept/CIK0000000123/us-gaap/NetIncomeLoss.json',
			onError: expect.any(Function),
		})
	})

	test('getFacts', async () => {
		const request = jest.spyOn(client, 'request')
		await secConnector.getFacts({ symbol: 'AAPL' })

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000123.json',
			onError: expect.any(Function),
		})
	})

	test('getSubmissions', async () => {
		const request = jest.spyOn(client, 'request')
		await secConnector.getSubmissions({ symbol: 'AAPL' })

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/submissions/CIK0000000123.json',
			onError: expect.any(Function),
		})
	})

	test('getFactFrame', async () => {
		const request = jest.spyOn(client, 'request')
		await secConnector.getFactFrame({ fact: 'AccountsPayable', taxonomy: 'dei', frame: 'CY2023Q3I', unit: 'USD' })

		expect(request).toHaveBeenCalledWith({
			url: 'https://data.sec.gov/api/xbrl/frames/dei/AccountsPayable/USD/CY2023Q3I.json',
			onError: expect.any(Function),
		})
	})
})

import { IClient } from '../src/services/Client'
import { IThrottler } from '../src/services/SecEdgarApi/Throttler'
import SecEdgarApi from '../src/services/SecEdgarApi'
import ReportParser from '../src/services/ReportParser'
import DocumentParser from '../src/services/DocumentParser'
import { submissionsResponse } from './__fixtures__/submission-response'
import { form13gXML } from './__fixtures__/form-13g'

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
		request.mockResolvedValue({
			data: Buffer.from(JSON.stringify(submissionsResponse)),
			message: '',
			statusCode: 200,
		})
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

	test('createRequestHolders', async () => {
		const filings = submissionsResponse.filings

		const fnGetDocumentXML = jest
			.spyOn(secEdgarApi, 'getDocumentXMLByUrl')
			.mockReturnValue(new Promise((resolve) => resolve(form13gXML)))

		const request = secEdgarApi.createRequestInstitutionalHolders({ symbol: 'AAPL', filings })
		const [response] = await request.requestAll()
		const { result } = response

		expect(request.getSize()).toBe(1)
		expect(request.getErrors().length).toBe(0)
		expect(request.getResults()[0].result).toBe(result)
		expect(request.getResults()[0].submission).toBe(request.getSubmissions()[0])
		expect(fnGetDocumentXML).toHaveBeenCalledWith({ url: request.getSubmissions()[0].url })

		// result data tested in DocumentParser.test.ts
		expect(result?.holders.length).toBe(7)
	})

	test('createRequestInsiderTransactions', async () => {
		const filings = submissionsResponse.filings

		const request = secEdgarApi.createRequestInsiderTransactions({ symbol: 'AAPL', filings })
		const response1 = await request.requestNext()
		const response2 = await request.requestNext()
		const response3 = await request.requestNext()

		// result data tested in DocumentParser.test.ts
		expect(request.getSize()).toBe(2)
		expect(response1.error).toBe(null)
		expect(response2.error).toBe(null)
		expect(response3.error).toBe('max requests reached')
	})

	test('createRequestEarningsReports', async () => {
		const filings = submissionsResponse.filings

		const request = secEdgarApi.createRequestInsiderTransactions({ symbol: 'AAPL', filings })
		expect(request.getSubmissions()).toHaveLength(2)
	})
})

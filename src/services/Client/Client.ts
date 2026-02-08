import { ClientRequest, IncomingMessage, RequestOptions } from 'http'
import * as https from 'https'

type Primitive = string | number | boolean | null | undefined

interface HttpClient {
	request: (options: string | URL | RequestOptions, callback?: (res: IncomingMessage) => void) => ClientRequest
}

export interface OnChunkData {
	percentComplete: number
	chunk: Buffer
}

export interface ClientResponse {
	statusCode: number
	message: string
	data: Buffer | null
}

export interface RequestParams {
	url: string
	headers?: Record<string, string>
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
	data?: string | Record<string, Primitive | object>
	timeout?: number
	onError?: (err: Error) => void
	onChunk?: (data: OnChunkData) => void
	onResponse?: (response: IncomingMessage) => void
	onSuccess?: (response: ClientResponse) => void
	resolveData?: boolean
}

export interface ClientArgs {
	httpClient?: HttpClient
	defaultHeaders?: Record<string, string>
}

export interface IClient {
	request(params: RequestParams): Promise<ClientResponse>
	setDefaultHeaders?(headers: Record<string, string>): void
	setUserAgent?(userAgent: string): void
}

export default class Client implements IClient {
	private readonly httpClient: HttpClient
	private defaultHeaders: Record<string, string>

	constructor(
		args: ClientArgs = {
			httpClient: https,
			defaultHeaders: {
				// this can be any user agent, just not empty
				'Accept-Encoding': 'gzip, deflate',
				Host: 'www.sec.gov',
				'User-Agent': 'Sample Company Name AdminContact@samplecompanydomain.com',
			},
		},
	) {
		const { httpClient, defaultHeaders } = args
		this.httpClient = httpClient ?? https
		this.defaultHeaders = defaultHeaders ?? {}
	}

	public setDefaultHeaders(headers: Record<string, string>) {
		this.defaultHeaders = headers
	}

	public setUserAgent(userAgent: string) {
		this.defaultHeaders['User-Agent'] = userAgent
	}

	public request(params: RequestParams): Promise<ClientResponse> {
		const {
			url,
			data,
			headers,
			onChunk,
			onResponse,
			onError,
			onSuccess,
			resolveData = true,
			method = 'GET',
			timeout = 86400000,
		} = params

		const allHeaders = { ...this.defaultHeaders, ...headers }

		return new Promise((resolve, reject) => {
			let responseData = ''
			const request = this.httpClient.request(url, function (res) {
				const lengthTotal = parseInt(res.headers['content-length'] ?? '0')
				let lengthCurrent = 0
				onResponse?.(res)

				if (res.statusCode !== 200) {
					reject({
						statusCode: res.statusCode ?? 400,
						message: res.statusMessage ?? 'Bad Request',
						data: null,
					})
				}

				res.on('data', (chunk: Buffer) => {
					lengthCurrent += chunk.length
					if (resolveData) {
						responseData += chunk
					}

					onChunk?.({
						percentComplete: lengthCurrent / lengthTotal,
						chunk: Buffer.from(chunk),
					})
				})

				res.on('error', (err) => {
					onError?.(err)
					reject({
						statusCode: res.statusCode ?? 400,
						message: res.statusMessage ?? 'Bad Request',
						data: null,
					})
				})
				res.on('end', () => {
					const buffer = Buffer.from(responseData)
					const clientResponse: ClientResponse = {
						statusCode: res.statusCode ?? 200,
						message: res.statusMessage ?? 'OK',
						data: buffer,
					}

					onSuccess?.(clientResponse)
					resolve(clientResponse)
				})
			})

			request.on('timeout', () => {
				request.destroy()
				reject({
					statusCode: null,
					message: 'Connection Timeout',
					data: null,
				})
			})

			request.setTimeout(timeout, () => reject(`timeout after ${timeout}ms`))

			for (const key in allHeaders) {
				request.setHeader(key, allHeaders[key])
			}

			if (data) {
				if (typeof data === 'string') request.write(data)
				else request.write(JSON.stringify(data))
			}

			request.method = method
			request.end()
		})
	}
}

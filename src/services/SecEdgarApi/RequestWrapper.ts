export interface RequestWrapperOptions {
	maxRequests?: number
}

export interface SendRequestParams {
	url: string
}

interface RequestWrapperArgs<T> {
	urls: string[]
	options?: RequestWrapperOptions
	sendRequest: (params: SendRequestParams) => Promise<T | T[]>
}

export default class RequestWrapper<T> {
	private results: T[]
	private readonly options: RequestWrapperOptions

	private readonly urls: string[]
	private readonly errors: string[]

	private readonly sendRequest: (params: SendRequestParams) => Promise<T | T[]>

	private requestCount: number
	private isDone: boolean

	constructor(args: RequestWrapperArgs<T>) {
		const { urls, options = {}, sendRequest } = args
		this.options = options
		this.urls = urls
		this.results = []
		this.errors = []
		this.sendRequest = sendRequest
		this.requestCount = 0
		this.isDone = options?.maxRequests === 0
	}

	public setOptions(options: RequestWrapperOptions) {
		for (const key in options) {
			this.options[key as keyof RequestWrapperOptions] = options[key as keyof RequestWrapperOptions]
		}
	}

	public async requestNext(): Promise<T[] | null> {
		const { maxRequests = Infinity } = this.options
		if (this.requestCount >= maxRequests || this.isDone) return null

		const url = this.urls[this.requestCount]
		this.requestCount++

		if (this.requestCount >= this.urls.length || this.requestCount >= maxRequests) {
			this.isDone = true
		}

		try {
			const result = await this.sendRequest({ url })
			const resultArr = Array.isArray(result) ? result : [result]
			resultArr.forEach((result) => this.results.push(result))
			return resultArr
		} catch (e) {
			const error = e as Error
			this.errors.push(error.message)
		}

		return null
	}

	public skip(count = 1) {
		this.requestCount += count
	}

	public async requestAll(): Promise<T[]> {
		const promises: Promise<T[] | null>[] = []

		const maxRequests = this.options.maxRequests ?? this.urls.length
		for (let i = 0; i < maxRequests; i++) {
			promises.push(this.requestNext())
		}

		const resultsArr = await Promise.all(promises)
		const resultsFlat: T[] = []

		resultsArr.forEach((results) => {
			results?.forEach((result) => resultsFlat.push(result))
		})

		this.clearResults()
		this.results = resultsFlat

		return resultsFlat
	}

	public clearResults() {
		this.results = []
	}

	public getResults() {
		return this.results
	}

	public getErrors() {
		return this.errors
	}

	public getSize() {
		return this.urls.length
	}
}

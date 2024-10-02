import { FilingListItemTranslated } from '../../types/submission.type'

export interface SubmissionRequestWrapperOptions {
	maxRequests?: number
}

export interface SendRequestParams {
	url: string
}

interface SubmissionRequestWrapperArgs<T> {
	submissions: FilingListItemTranslated[]
	usePrimaryDocument: boolean
	options?: SubmissionRequestWrapperOptions
	sendRequest: (params: SendRequestParams) => Promise<T>
}

interface SubmissionRequestWrapperResult<T> {
	result: T | null
	error: string | null
	submission: FilingListItemTranslated
}

export default class SubmissionRequestWrapper<T> {
	private results: SubmissionRequestWrapperResult<T>[]
	private readonly options: SubmissionRequestWrapperOptions
	private readonly submissions: FilingListItemTranslated[]
	private readonly errors: string[]
	private readonly usePrimaryDocument: boolean

	private readonly sendRequest: (params: SendRequestParams) => Promise<T>

	private requestCount: number
	private isDone: boolean

	constructor(args: SubmissionRequestWrapperArgs<T>) {
		const { submissions, options = {}, sendRequest, usePrimaryDocument } = args
		this.options = options
		this.submissions = submissions
		this.results = []
		this.errors = []
		this.usePrimaryDocument = usePrimaryDocument
		this.sendRequest = sendRequest
		this.requestCount = 0
		this.isDone = options?.maxRequests === 0
	}

	public setOptions(options: SubmissionRequestWrapperOptions) {
		for (const key in options) {
			this.options[key as keyof SubmissionRequestWrapperOptions] =
				options[key as keyof SubmissionRequestWrapperOptions]
		}
	}

	public async requestNext(): Promise<SubmissionRequestWrapperResult<T>> {
		const { maxRequests = Infinity } = this.options
		const submission = this.submissions[this.requestCount]
		const isComplete = this.requestCount >= maxRequests || this.isDone
		if (isComplete || !submission) {
			return {
				submission,
				error: isComplete ? 'max requests reached' : 'no submission found',
				result: null,
			}
		}

		const { url, urlPrimaryDocument } = submission
		const requestUrl = this.usePrimaryDocument ? urlPrimaryDocument : url
		this.requestCount++

		if (this.requestCount >= this.submissions.length || this.requestCount >= maxRequests) {
			this.isDone = true
		}

		try {
			const result = await this.sendRequest({ url: requestUrl })
			const data = {
				submission,
				error: null,
				result: result,
			}

			this.results.push(data)
			return data
		} catch (e) {
			const error = e as Error
			this.errors.push(error.message)
			return {
				submission,
				error: error.message,
				result: null,
			}
		}
	}

	public skip(count = 1) {
		this.requestCount += count
	}

	public async requestAll(): Promise<SubmissionRequestWrapperResult<T>[]> {
		const promises: Promise<SubmissionRequestWrapperResult<T>>[] = []

		const maxRequests = this.options.maxRequests ?? this.submissions.length
		for (let i = 0; i < maxRequests; i++) {
			promises.push(this.requestNext())
		}

		const results = await Promise.all(promises)
		results.forEach((result) => this.results.push(result))
		return results
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
		return this.submissions.length
	}

	public getSubmissions() {
		return this.submissions
	}
}

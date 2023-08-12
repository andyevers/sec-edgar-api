interface OnProgressData {
	queueLength: number
	countRunning: number
}

interface ThrottlerArgs {
	maxConcurrent?: number
	delayMs?: number
	onProgress?: (data: OnProgressData) => void
	onResult?: (result: any) => void
	onError?: (err: any) => void
	onEnd?: (results: any[], errors: any[]) => void
}

export interface IThrottler {
	setDelayMs(delayMs: number): void
	add: (fn: () => Promise<any>) => void
}

export default class Throttler implements IThrottler {
	private readonly decrementTimeouts: Set<NodeJS.Timeout>
	private readonly queue: (() => Promise<any>)[]
	private readonly results: any[]
	private readonly errors: any[]

	private maxConcurrent: number
	private delayMs: number

	public onProgress?: (data: OnProgressData) => void
	public onResult?: (result: any) => void
	public onError?: (err: any) => void
	public onEnd?: (results: any[], errors: any[]) => void

	constructor(args: ThrottlerArgs = {}) {
		const { maxConcurrent = 10, delayMs = 1100, onProgress, onResult, onError, onEnd } = args

		this.maxConcurrent = maxConcurrent
		this.delayMs = delayMs

		this.decrementTimeouts = new Set()
		this.queue = []
		this.results = []
		this.errors = []

		this.onProgress = onProgress
		this.onResult = onResult
		this.onError = onError
		this.onEnd = onEnd
	}

	public setDelayMs(delayMs: number) {
		this.delayMs = delayMs
	}

	public add(fn: () => Promise<any>) {
		this.queue.push(fn)
		this.run()
	}

	private async run() {
		const countRunning = this.decrementTimeouts.size
		if (countRunning >= this.maxConcurrent) {
			return
		}

		if (this.queue.length === 0) {
			if (countRunning === 0) {
				this.onEnd?.(this.results, this.errors)
			}
			return
		}

		const fn = this.queue.shift() as () => Promise<any>

		// record the request before it is made
		const decrementTimeout = setTimeout(() => {
			this.decrementTimeouts.delete(decrementTimeout)
			this.run()
		}, this.delayMs)

		this.decrementTimeouts.add(decrementTimeout)

		try {
			const result = await fn()
			this.results.push(result)
			this.onResult?.(result)
		} catch (err) {
			this.errors.push(err)
			this.onError?.(err)
		}

		this.onProgress?.({
			queueLength: this.queue.length,
			countRunning: this.decrementTimeouts.size,
		})
	}
}

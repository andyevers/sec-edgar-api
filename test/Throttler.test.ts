import Throttler from '../src/services/SecEdgarApi/Throttler'

describe('Throttler', () => {
	test('add', async () => {
		const delayMs = 50
		const countPromises = 10

		const throttler = new Throttler({ delayMs, maxConcurrent: 1 })

		const promises = Array.from({ length: countPromises }).map((_, i) => {
			return new Promise((resolve) => throttler.add(async () => resolve(i)))
		})

		const timeStart = performance.now()

		await Promise.all(promises)

		const timeEnd = performance.now()
		const timeElapsed = timeEnd - timeStart

		expect(timeElapsed).toBeGreaterThanOrEqual(delayMs * (countPromises - 1))
	})
})

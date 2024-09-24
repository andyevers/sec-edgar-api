import ReportBuilder from '../src/services/ReportBuilder'
import { factsAAPL } from './__fixtures__/facts-AAPL'
import { factsGOOGL } from './__fixtures__/facts-GOOGL'

describe('ReportBuilder', () => {
	const reportBuilder = new ReportBuilder()

	test('buildReports split adjusted EPS', () => {
		const reportsAAPL = reportBuilder.buildReports(reportBuilder.createFacts(factsAAPL))
		const reportsGOOGL = reportBuilder.buildReports(reportBuilder.createFacts(factsGOOGL))

		const reportAAPLQ42018 = reportsAAPL.find(
			(report) => report.fiscalYear === 2018 && report.fiscalPeriod === 'Q4',
		)!
		const reportAAPLQ12019 = reportsAAPL.find(
			(report) => report.fiscalYear === 2019 && report.fiscalPeriod === 'Q1',
		)!
		const reportGOOGLQ42020 = reportsGOOGL.find(
			(report) => report.fiscalYear === 2020 && report.fiscalPeriod === 'Q4',
		)!

		const epsAAPLQ42018 = reportAAPLQ42018.EarningsPerShareBasic
		const epsAAPLQ12019 = reportAAPLQ12019.EarningsPerShareBasic
		const epsGOOGLQ42020 = reportGOOGLQ42020.EarningsPerShareBasic

		expect(epsAAPLQ42018).toBeCloseTo(0.735)
		expect(epsAAPLQ12019).toBeCloseTo(1.055)
		expect(epsGOOGLQ42020).toBeCloseTo(1.127)
	})
})

import type { FiscalPeriod, ReportRaw, ReportTranslated } from '../../types'
import ReportTranslatedProxy from './ReportTranslatedProxy'

/**
 * Contains translated report and raw report with methods to access other reports
 */
export default class ReportWrapper extends ReportTranslatedProxy implements ReportTranslated {
	private readonly report: ReportTranslated
	private readonly reportMap: Map<string, ReportWrapper>
	private readonly reportRaw: ReportRaw

	constructor(report: ReportTranslated, reportRaw?: ReportRaw, reportMap?: Map<string, ReportWrapper>) {
		super(report)
		this.report = report
		this.reportMap = reportMap ?? new Map()
		this.reportRaw = reportRaw ?? {
			cik: report.cik,
			url: report.url,
			dateFiled: report.dateFiled,
			dateReport: report.dateReport,
			fiscalPeriod: (report.fiscalPeriod ?? '') as FiscalPeriod,
			fiscalYear: report.fiscalYear,
			splitRatio: null,
			splitDate: null,
		}
	}

	/**
	 * when using JSON.stringify on this class instance, it will stringify the report
	 */
	public toJSON() {
		return this.report
	}

	public getReportRaw() {
		return this.reportRaw
	}

	public getReport() {
		return this.report
	}

	/**
	 * Gets report wrapper for prev or future report
	 *
	 * @param offset positive number returns future report, negative returns past
	 */
	public getReportOffset(offset: number, reportType: 'QUARTERLY' | 'ANNUAL'): ReportWrapper | null {
		const { fiscalPeriod, fiscalYear } = this.report
		if (reportType === 'ANNUAL') {
			return this.reportMap.get(`${fiscalYear + offset}_FY`) ?? null
		}

		const period = fiscalPeriod === 'FY' ? 'Q4' : fiscalPeriod
		const currentQuarter = Number(period.substring(1))
		const isCeilOffsetYear = currentQuarter + (offset % 4) > 4 || (offset < 0 && currentQuarter + (offset % 4) > 0)
		const targetYear = isCeilOffsetYear ? fiscalYear + Math.ceil(offset / 4) : fiscalYear + Math.floor(offset / 4)

		const targetQuarter = Math.abs(
			currentQuarter + offset < 0 ? ((currentQuarter + offset) % 4) + 4 : (currentQuarter + offset) % 4 || 4,
		)

		return this.reportMap.get(`${targetYear}_Q${targetQuarter}`) ?? null
	}

	/**
	 * Gets report wrappers in the same fiscal year as this report
	 */
	public getReportsFiscalYearByPeriod(
		fiscalYear = this.report.fiscalYear,
	): Record<FiscalPeriod, ReportWrapper | null> {
		return {
			FY: this.reportMap.get(`${fiscalYear}_FY`) ?? null,
			Q1: this.reportMap.get(`${fiscalYear}_Q1`) ?? null,
			Q2: this.reportMap.get(`${fiscalYear}_Q2`) ?? null,
			Q3: this.reportMap.get(`${fiscalYear}_Q3`) ?? null,
			Q4: this.reportMap.get(`${fiscalYear}_Q4`) ?? null,
		}
	}
}

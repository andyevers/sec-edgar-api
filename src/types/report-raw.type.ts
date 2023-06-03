/**
 * Contains all keys matched from the report, along with the added keys dateEnd, dateFiled, fiscalPeriod, fiscalYear.
 */
export type ReportRaw = {
	[key: string]: string | number | boolean
	dateReport: string
	dateFiled: string
	form: string
	isTTM: boolean
	frame: string
	taxonomy: string
	reportType: ReportType
	fiscalPeriod: FiscalPeriod
	fiscalYear: number
}

/**
 * QUARTERLY = 10-Q and 10-K forms for the quarter | ANNUAL = 10-K forms for the year |
 * 8K = all 8K form types | DOCUMENT_ENTITY_INFO = reports under key dei
 *
 * for dei, see https://www.sec.gov/structureddata/announcement/osd-announcement-2212-new-2022q4-taxonomies
 */
export type ReportType = 'QUARTERLY' | 'ANNUAL' | '8K' | 'DOCUMENT_ENTITY_INFO'

export type FiscalPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY'

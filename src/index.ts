import ReportParser from './services/ReportParser'
import SecEdgarApi from './services/SecEdgarApi'
import ReportResolvable from './services/ReportParser/ReportResolvable'
import { utilMap } from './util/util-map'

/**
 * Takes company facts data from the SEC and translates them to
 * reports as json objects.
 */
const reportParser = new ReportParser()

/**
 * Gets company reports and filings from the SEC EDGAR API. Requests are
 * throttled with 120ms delay between requests to avoid rate limiting.
 *
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
const secEdgarApi = new SecEdgarApi()

export { reportParser, secEdgarApi, ReportResolvable, utilMap }
export type * from './types'

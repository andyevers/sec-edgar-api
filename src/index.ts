import FactFileReader from './services/FactFileReader'
import ReportParser from './services/ReportParser'
import SecEdgarApi from './services/SecEdgarApi'

/**
 * Takes company facts data from the SEC and translates them to
 * reports as json objects.
 */
const reportParser = new ReportParser()

/**
 * Reads files from the companyfacts directory (which can be downloaded
 * using secEdgarApi.downloadCompanyFacts()).
 */
const factFileReader = new FactFileReader()

/**
 * Gets company reports and filings from the SEC EDGAR API. Requests are
 * throttled with 120ms delay between requests to avoid rate limiting.
 *
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
const secEdgarApi = new SecEdgarApi()

export { reportParser, factFileReader, secEdgarApi }

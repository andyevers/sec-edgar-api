import FactsDownloader from './services/FactsDownloader'

/**
 * Downloads companyfacts.zip from sec.gov and extracts the directory
 */
const factsDownloader = new FactsDownloader()

export { factsDownloader }

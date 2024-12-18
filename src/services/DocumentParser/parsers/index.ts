import { parseForm4 } from './parse-form-4'
import { parseForm13g } from './parse-form-13g'
import { parseForm10k } from './parse-form-10k'
import { parseFormDef14a } from './parse-form-def14a'
import { parseCurrentFilingsDaily } from './parse-current-filings-daily'
import { parseInsiderTransactions } from './parse-insider-transaction'
import { parseCompanies } from './parse-companies'
import { parseCurrentFilings } from './parse-current-filings'
import { parseCurrentFilingsXbrl } from './parse-current-filings-xbrl'
import { parseXbrl } from './parse-xbrl'

const parsers = {
	parseForm4,
	parseForm13g,
	parseForm10k,
	parseFormDef14a,
	parseCurrentFilingsDaily,
	parseInsiderTransactions,
	parseCompanies,
	parseCurrentFilings,
	parseCurrentFilingsXbrl,
	parseXbrl,
}

export default parsers

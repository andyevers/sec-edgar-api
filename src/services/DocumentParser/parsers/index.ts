import { parseForm4 } from './parse-form-4'
import { parseForm13g } from './parse-form-13g'
import { parseForm10k } from './parse-form-10k'

const parsers = {
	parseForm4,
	parseForm13g,
	parseForm10k,
}

export default parsers

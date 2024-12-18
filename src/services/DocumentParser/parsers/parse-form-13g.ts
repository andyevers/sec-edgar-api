import { Form13GData, InstitutionalHolder, XMLParams } from '../../../types'
import XMLParser from '../XMLParserLegacy'

/**
 * Form SC 13G - Institutional Holders
 *
 * example at https://www.sec.gov/Archives/edgar/data/320193/000119312523038262/d382361dsc13ga.htm
 */
export function parseForm13g(params: XMLParams, xmlParser = new XMLParser()): Form13GData {
	const { xml } = params

	const textMap = xmlParser.getTableTextMap({ xml })

	const holders: InstitutionalHolder[] = []

	const getKey = (text: string): keyof InstitutionalHolder | null => {
		const keyMap: Record<string, keyof InstitutionalHolder> = {
			'name of reporting': 'name',
			'names of reporting': 'name',
			'citizenship or place': 'origin',
			'sole voting power': 'votingPowerSole',
			'shared voting power': 'votingPowerShared',
			'sole dispositive power': 'dispositivePowerSole',
			'shared dispositive power': 'dispositivePowerShared',
			'aggregate amount beneficially owned': 'shares',
			'percent of class': 'percentOfClass',
			'type of reporting person': 'typeOfReportingPerson',
		}

		const textLower = text.toLowerCase()
		for (const key in keyMap) {
			if (textLower.includes(key)) return keyMap[key]
		}

		return null
	}

	for (const text of Array.from(textMap.values())) {
		const colName = getKey(text)
		const isNewHolder = colName === 'name'

		if (isNewHolder) {
			if (holders[holders.length - 1]?.name === '') {
				holders.pop()
			}
			holders.push({
				name: '',
				origin: '',
				shares: 0,
				percentOfClass: '',
				votingPowerSole: null,
				votingPowerShared: null,
				dispositivePowerSole: null,
				dispositivePowerShared: null,
				typeOfReportingPerson: null,
			})
		}

		const holder = holders[holders.length - 1]

		// continue if no colName or if the value is already set
		if (colName === null || ![0, '', null].includes(holder[colName])) continue

		const textParts = text.split('&nbsp;').filter((t) => t.trim() !== '')
		const colNameIndex = textParts.findIndex((t) => getKey(t) === colName)
		const value = textParts[colNameIndex + 1]?.trim() ?? ''

		switch (colName) {
			case 'shares':
				holder.shares = Number(value.replace(/[^0-9]/g, '')) || 0
				break
			case 'typeOfReportingPerson':
				holder[colName] = value === '' ? null : value
				break
			case 'votingPowerSole':
			case 'votingPowerShared':
			case 'dispositivePowerSole':
			case 'dispositivePowerShared':
				holder[colName] = value.toLowerCase() === 'none' ? null : value
				break
			default:
				holder[colName] = value
		}
	}

	if (holders[holders.length - 1]?.name === '') {
		holders.pop()
	}

	return { holders }
}

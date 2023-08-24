import { Holder, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

/**
 * Form SC 13G - Holders
 *
 * example at https://www.sec.gov/Archives/edgar/data/320193/000119312523038262/d382361dsc13ga.htm
 */
export function parseForm13g(params: XMLParams, xmlParser = new XMLParser()): Holder[] {
	const { xml } = params

	const textMap = xmlParser.getTableTextMap({ xml })

	const holders: Holder[] = []

	const header: (keyof Holder)[] = [
		'name',
		'origin',
		'votingPowerSole',
		'votingPowerShared',
		'dispositivePowerSole',
		'dispositivePowerShared',
		'shares',
		'percentOfClass',
		'typeOfReportingPerson',
	]
	const rowColKeys = ['2.3', '5.3', '6.5', '7.4', '8.4', '9.4', '10.3', '12.3', '13.3']

	for (let row = 3; row < 10_000; row += 2) {
		const keyFirst = `${row}.${rowColKeys[0]}`
		const isComplete = !textMap.has(keyFirst) || !textMap.get(keyFirst)?.toLowerCase().includes('name')
		if (isComplete) break

		const holder: Holder = {
			name: '',
			origin: '',
			shares: 0,
			percentOfClass: '',
			votingPowerSole: null,
			votingPowerShared: null,
			dispositivePowerSole: null,
			dispositivePowerShared: null,
			typeOfReportingPerson: null,
		}

		for (let i = 0; i < rowColKeys.length; i++) {
			const key = `${row}.${rowColKeys[i]}`
			const colName = header[i]
			const text = textMap.get(key) ?? ''
			const value = text.substring(text.lastIndexOf('&nbsp;') + '&nbsp;'.length).trim()

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

		holders.push(holder)
	}

	return holders
}

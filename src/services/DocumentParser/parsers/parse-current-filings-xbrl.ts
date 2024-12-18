import { CurrentFilingsXBRL, XMLParams } from '../../../types'
import XMLParser from '../XMLParser'

export function parseCurrentFilingsXbrl(params: XMLParams): CurrentFilingsXBRL {
	const { xml } = params

	const xmlParser = new XMLParser()

	const result: CurrentFilingsXBRL = {
		title: '',
		link: '',
		language: '',
		lastBuildDate: '',
		pubDate: '',
		description: '',
		items: [],
	}

	let lastOpenTag = ''
	xmlParser.iterateXML({
		xml: xml,
		onInnerText: (text) => {
			const textTrimmed = text.trim()
			const items = result.items
			const latestItem = (items[items.length - 1] ?? result) as unknown as Record<string, string | number>
			const tag = textTrimmed ? lastOpenTag.split(':').pop() ?? '' : ''

			if (latestItem?.[tag] === undefined || !textTrimmed) return

			let value = textTrimmed
			switch (tag) {
				case 'filingDate': {
					const [month, day, year] = value.split('/')
					value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
					break
				}

				case 'acceptanceDatetime': {
					const year = value.substring(0, 4)
					const month = value.substring(4, 6)
					const day = value.substring(6, 8)
					const hour = value.substring(8, 10)
					const minute = value.substring(10, 12)
					const second = value.substring(12, 14)
					value = `${year}-${month}-${day}T${hour}:${minute}:${second}:000Z`
				}
			}

			latestItem[tag] = typeof latestItem[tag] === 'number' ? Number(value) : value
		},

		onOpenTag: (tagName, attributes) => {
			lastOpenTag = tagName
			switch (tagName) {
				case 'edgar:xbrlFile': {
					const item = result.items[result.items.length - 1]
					const attributesMap = xmlParser.mapAttributes(attributes)

					item?.files.push({
						url: attributesMap.get('edgar:url') ?? '',
						description: attributesMap.get('edgar:description') ?? '',
						file: attributesMap.get('edgar:file') ?? '',
						inlineXBRL: attributesMap.get('edgar:inlineXBRL') === 'true',
						sequence: Number(attributesMap.get('edgar:sequence') ?? -1),
						size: Number(attributesMap.get('edgar:size') ?? -1),
						type: attributesMap.get('edgar:type') ?? '',
					})
					break
				}
				case 'item': {
					result.items.push({
						title: '',
						companyName: '',
						cikNumber: 0,
						link: '',
						period: '',
						pubDate: '',
						fileNumber: '',
						filingDate: '',
						fiscalYearEnd: '',
						formType: '',
						acceptanceDatetime: '',
						accessionNumber: '',
						assignedSic: 0,
						assistantDirector: '',
						enclosureUrl: '',
						enclosureLength: 0,
						enclosureType: '',
						guid: '',
						description: '',
						files: [],
					})
					break
				}
				case 'enclosure': {
					const latestItem = result.items[result.items.length - 1]
					if (!latestItem) return
					const attributesMap = xmlParser.mapAttributes(attributes)
					latestItem.enclosureUrl = attributesMap.get('url') ?? ''
					latestItem.enclosureLength = Number(attributesMap.get('length') ?? 0)
					latestItem.enclosureType = attributesMap.get('type') ?? ''
				}
			}
		},
	})

	return result
}

import { CurrentFilingsXBRL, XMLParams } from '../../../types'

function mapAttributes(attributes: string[]) {
	const attributesMap = new Map<string, string>()
	attributes.forEach((attr) => {
		const [key, value] = attr.split('=')
		if (!value) return
		attributesMap.set(key, value.substring(1, value.length - 1))
	})
	return attributesMap
}

function iterateXML(params: {
	xml: string
	onOpenTag?: (tagName: string, attributes: string[]) => void
	onCloseTag?: (tagName: string) => void
	onInnerText?: (text: string) => void
}) {
	const { onCloseTag, onInnerText, onOpenTag, xml } = params

	for (let i = 0; i < xml.length; i++) {
		if (xml[i] === '<' && xml[i + 1] !== '/') {
			i++
			const tagEndIndex = xml.indexOf('>', i)
			const currentTagStr = xml.substring(i, tagEndIndex)
			const tagName = currentTagStr.split(' ', 1)[0]
			const attributes = currentTagStr.split(' ').slice(1)
			if (!attributes[attributes.length - 1]?.includes('=')) {
				attributes.pop()
			}
			i = tagEndIndex
			onOpenTag?.(tagName, attributes)
		} else if (xml[i] === '<' && xml[i + 1] === '/') {
			i += 2
			const tagEndIndex = xml.indexOf('>', i)
			const currentTagStr = xml.substring(i, tagEndIndex)
			i = tagEndIndex
			onCloseTag?.(currentTagStr)
		} else {
			const nextOpenTagIndex = xml.indexOf('<', i)
			const nextIndex = nextOpenTagIndex === -1 ? xml.length : nextOpenTagIndex
			const text = xml.substring(i, nextIndex)
			onInnerText?.(text)
			i = nextIndex - 1
		}
	}
}

export function parseCurrentFilingsXBRL(params: XMLParams): CurrentFilingsXBRL {
	const { xml } = params

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
	iterateXML({
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
					const attributesMap = mapAttributes(attributes)

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
					const attributesMap = mapAttributes(attributes)
					latestItem.enclosureUrl = attributesMap.get('url') ?? ''
					latestItem.enclosureLength = Number(attributesMap.get('length') ?? 0)
					latestItem.enclosureType = attributesMap.get('type') ?? ''
				}
			}
		},
	})

	return result
}

export default class XMLIterator {
	public mapAttributes(attributes: string[]) {
		const attributesMap = new Map<string, string>()
		attributes.forEach((attr) => {
			const [key, value] = attr.split('=')
			if (!value) return
			attributesMap.set(key, value.substring(1, value.length - 1))
		})
		return attributesMap
	}

	public iterateXML(params: {
		xml: string
		onOpenTag?: (tagName: string, attributes: string[], isSelfEnclosing: boolean) => void
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
				const lastAttribute = attributes[attributes.length - 1]

				if (lastAttribute?.endsWith('/')) {
					attributes[attributes.length - 1] = lastAttribute.substring(0, lastAttribute.length - 1)
				}

				if (!lastAttribute || !lastAttribute.includes('=')) {
					attributes.pop()
				}

				i = tagEndIndex
				const isSelfEnclosing = xml[tagEndIndex - 1] === '/'
				onOpenTag?.(tagName, attributes, isSelfEnclosing)
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
}

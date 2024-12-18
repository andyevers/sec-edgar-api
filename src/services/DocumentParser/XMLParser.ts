export default class XMLParser {
	private readonly selfEnclosingTags = new Set([
		'!doctype',
		'?xml',
		'xml',
		'hr',
		'br',
		'img',
		'input',
		'meta',
		'filename',
		'description',
	])

	public mapAttributes(attributes: string[]) {
		const attributesMap = new Map<string, string>()
		attributes.forEach((attr) => {
			const [key, value] = attr.split('=')
			if (!value) return
			attributesMap.set(key, value.replace(/"/g, '').trim())
		})
		return attributesMap
	}

	public parse(xml: string) {
		let currentObj: Record<string, unknown> = {}
		const objPath: Record<string, unknown>[] = [currentObj]

		this.iterateXML({
			xml: xml,
			onOpenTag: (tagName, attributes, isSelfEnclosing) => {
				const newObj: Record<string, unknown> = {}
				const obj = currentObj

				const isComment = tagName.startsWith('!--')
				if (isComment || tagName === '?xml') return

				if (obj[tagName] === undefined) {
					obj[tagName] = newObj
				} else if (Array.isArray(obj[tagName])) {
					;(obj[tagName] as object[]).push(newObj)
				} else if (typeof obj[tagName] === 'object') {
					obj[tagName] = [obj[tagName], newObj]
				}

				this.mapAttributes(attributes).forEach((value, att) => {
					newObj[`@_${att}`] = value
				})

				if (!isSelfEnclosing) {
					objPath.push(newObj)
					currentObj = newObj
				}
			},
			onInnerText: (text) => {
				const textTrimmed = text.trim()
				if (!textTrimmed) return
				const obj = currentObj as Record<string, unknown>
				obj['#text'] = textTrimmed
			},
			onCloseTag: () => {
				if (objPath.length === 1) return
				objPath.pop()
				currentObj = objPath[objPath.length - 1]
			},
		})

		return objPath[0]
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
				const tagName = currentTagStr.split(' ', 1)[0].trim()
				const attributes = currentTagStr.split(' ').slice(1)
				const lastAttribute = attributes[attributes.length - 1]

				if (lastAttribute?.endsWith('/')) {
					attributes[attributes.length - 1] = lastAttribute.substring(0, lastAttribute.length - 1)
				}

				if (!lastAttribute || !lastAttribute.includes('=')) {
					attributes.pop()
				}

				i = tagEndIndex
				const isSelfEnclosing =
					xml[tagEndIndex - 1] === '/' || this.selfEnclosingTags.has(tagName.toLowerCase())
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

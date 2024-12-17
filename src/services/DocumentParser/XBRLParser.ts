import DocumentXmlSplitter, { DocumentData } from './DocumentXmlSplitter'
import XMLIterator from './XMLIterator'

interface XbrlContext {
	id: string
	entity: {
		identifier: {
			value: string
			scheme: string
		}
		segment: {
			value: string
			dimension: string
		}[]
	}
	period: {
		startDate?: string
		endDate?: string
		instant?: string
	}
}

interface XbrlUnit {
	id: string
	measure: string
}

interface XbrlElementUnknown {
	// _key: string
	id: string
	name: string
	contextRef: string
	continuedAt?: string
	decimals?: string
	escape?: string
	format?: string
	order?: string
	precision?: string
	scale?: string
	sign?: string
	target?: string
	text?: string
	tupleID?: string
	tupleRef?: string
	unitRef?: string
}

export default class XBRLParser {
	private readonly splitter = new DocumentXmlSplitter()
	private readonly xmlIterator = new XMLIterator()

	public parseXBRL(params: { xml: string; includeFacts?: boolean }) {
		const { xml } = params
		const { documents } = this.splitter.splitDocumentXml({ xml })
		const xbrlDocuments: (DocumentData & { facts: XbrlElementUnknown[] })[] = []

		const extensionsToSkip = new Set([
			'zip',
			'pdf',
			'jpg',
			'png',
			'jpeg',
			'gif',
			'doc',
			'docx',
			'xls',
			'xlsx',
			'ppt',
			'pptx',
		])

		for (const document of documents) {
			const extension = document.fileName.split('.').pop() ?? ''
			if (extensionsToSkip.has(extension)) {
				continue
			}
			const xbrlDocument = this.parseInstanceDocument(document)

			if (xbrlDocument) {
				xbrlDocuments.push(xbrlDocument as unknown as DocumentData & { facts: XbrlElementUnknown[] })
			}
		}

		return xbrlDocuments
	}

	/**
	 * Extract XBRL Facts from an instance document
	 */
	private parseInstanceDocument(document: DocumentData) {
		const { content, description, fileName, sequence, type } = document
		const contentLower = content.toLowerCase()

		const indexXbrlStart = contentLower.indexOf('<xbrl')
		const indexXbrlEnd = contentLower.lastIndexOf('</xbrl')
		const xbrlContent = content.substring(indexXbrlStart, indexXbrlEnd + 7)

		if (indexXbrlStart === -1) {
			return null
		}

		let isInContext = false
		let isInUnit = false
		let isInFact = false

		let mostRecentTag = ''

		const contextItems: XbrlContext[] = []
		const units: XbrlUnit[] = []
		const facts: XbrlElementUnknown[] = []

		let mostRecentFactKey = ''

		const getTagSuffix = (tag: string) => tag.substring(tag.lastIndexOf(':') + 1)

		const allowedFactAtts = new Set<string>([
			'decimals',
			'escape',
			'format',
			'order',
			'precision',
			'scale',
			'sign',
			'target',
			'tupleID',
			'tupleRef',
			'unitRef',
		])

		this.xmlIterator.iterateXML({
			xml: xbrlContent,
			onInnerText: (text) => {
				if (!text.trim()) return
				if (isInUnit && getTagSuffix(mostRecentTag) === 'measure') {
					units[units.length - 1].measure = text
				} else if (isInContext) {
					const context = contextItems[contextItems.length - 1]
					const tagSuffix = getTagSuffix(mostRecentTag)
					const segment = context.entity.segment[context.entity.segment.length - 1]

					if (tagSuffix.endsWith('.domain')) {
						segment.value = text
						return
					}

					switch (tagSuffix) {
						case 'identifier':
							context.entity.identifier.value = text
							break
						case 'explicitMember':
							segment.value = text
							break
						case 'startDate':
						case 'endDate':
						case 'instant':
							context.period[tagSuffix] = text
							break
					}
				} else if (isInFact) {
					facts[facts.length - 1].text = text
				}
			},
			onOpenTag: (tagName, attributes) => {
				mostRecentTag = tagName

				const tagSuffix = getTagSuffix(tagName)

				switch (tagSuffix) {
					case 'context': {
						isInContext = true
						const attributeMap = this.xmlIterator.mapAttributes(attributes)
						contextItems.push({
							id: attributeMap.get('id') ?? '',
							entity: {
								identifier: {
									scheme: attributeMap.get('scheme') ?? '',
									value: '',
								},
								segment: [],
							},
							period: {},
						})
						break
					}

					case 'explicitMember':
					case 'typedMember': {
						const context = contextItems[contextItems.length - 1]
						const attributeMap = this.xmlIterator.mapAttributes(attributes)
						const dimension = attributeMap.get('dimension') ?? ''
						context.entity.segment.push({ dimension, value: '' })
						break
					}

					case 'unit': {
						isInUnit = true
						const attributeMap = this.xmlIterator.mapAttributes(attributes)
						const id = attributeMap.get('id') ?? ''
						units.push({ id, measure: '' })
						break
					}
				}

				const isFact = attributes.some((a) => a.startsWith('contextRef'))

				if (isFact) {
					isInFact = true
					mostRecentFactKey = tagName
					const attributeMap = this.xmlIterator.mapAttributes(attributes)
					const contextRef = attributeMap.get('contextRef') ?? ''
					const fact: XbrlElementUnknown = {
						name: tagName,
						id: attributeMap.get('id') ?? '',
						contextRef,
					}

					attributeMap.forEach((value, key) => {
						if (allowedFactAtts.has(key)) {
							fact[key as keyof typeof fact] = value
						}
					})

					facts.push(fact)
				}
			},
			onCloseTag: (tagName) => {
				if (tagName === mostRecentFactKey) {
					isInFact = false
					mostRecentFactKey = ''
					return
				}

				const tagSuffix = getTagSuffix(tagName)
				switch (tagSuffix) {
					case 'context':
						isInContext = false
						break
					case 'unit':
						isInUnit = false
						break
				}
			},
		})

		const contextById = new Map<string, XbrlContext>()
		contextItems.forEach((c) => contextById.set(c.id, c))

		const unitById = new Map<string, XbrlUnit>()
		units.forEach((u) => unitById.set(u.id, u))

		const factItems = facts.map((fact) => {
			const context = contextById.get(fact.contextRef)
			const unit = fact.unitRef ? unitById.get(fact.unitRef) : null

			return {
				...fact,
				cik: Number(context?.entity.identifier.value ?? '') || 0,
				end: context?.period.endDate ?? '',
				// filed: context?.period.instant ?? '',
				unit: unit?.measure ?? '',
				value: fact.text ?? '',
				start: context?.period.startDate ?? '',
				segments: context?.entity.segment,
			}
		})

		return {
			description,
			fileName,
			sequence,
			type,
			facts: factItems,
		}
	}
}

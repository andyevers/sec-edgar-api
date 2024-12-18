/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	XbrlLinkbase,
	XbrlLinkbaseItemArc,
	XbrlLinkbaseItemExtended,
	XbrlLinkbaseItemLocator,
	XbrlLinkbaseItemResource,
	XbrlLinkbaseItemSimple,
} from '../../../types/xbrl.type'
import XMLParser from '../XMLParser'
import utilType from './util-type'

export default class LinkbaseParser {
	private readonly xmlParser: XMLParser

	constructor(args?: { xmlParser?: XMLParser }) {
		const { xmlParser = new XMLParser() } = args ?? {}
		this.xmlParser = xmlParser
	}

	public parse(xml: string) {
		const parsed = this.xmlParser.parse(xml)
		return this.parseLinkbaseDocument(parsed.XBRL ?? parsed.xbrl ?? parsed)
	}

	private parseLinkbaseDocument(value: any): XbrlLinkbase | null {
		value = utilType.toObject(value)

		for (const key in value) {
			const parsedKey = utilType.parseKey(key)
			switch (parsedKey) {
				case 'linkbase':
					return this.parseLinkbase(value[key])
			}
		}

		return null
	}

	private parseItem(
		value: any,
	): XbrlLinkbaseItemSimple | XbrlLinkbaseItemLocator | XbrlLinkbaseItemArc | XbrlLinkbaseItemResource {
		value = utilType.toObject(value)
		const item: any = {}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as
				| keyof XbrlLinkbaseItemSimple
				| keyof XbrlLinkbaseItemLocator
				| keyof XbrlLinkbaseItemArc
				| keyof XbrlLinkbaseItemResource

			switch (parsedKey) {
				case 'closed':
					item[parsedKey] = utilType.toBoolean(value[key])
					break
				case 'priority':
				case 'order':
				case 'weight':
					item[parsedKey] = utilType.toNumber(value[key])
					break
				default:
					item[parsedKey] = utilType.toString(value[key])
					break
			}
		}

		return item
	}

	private parseLinkbase(value: any): XbrlLinkbase {
		value = utilType.toObject(value)
		const linkbase: XbrlLinkbase = {}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as keyof Omit<XbrlLinkbase, 'id'>
			switch (parsedKey) {
				case 'referenceLink':
				case 'labelLink':
				case 'presentationLink':
				case 'calculationLink':
				case 'definitionLink':
					linkbase[parsedKey] = utilType.toArray(value[key]).map((v: any) => this.parseItemExtended(v))
					break
				case 'roleRef':
				case 'arcroleRef':
					linkbase[parsedKey] = utilType.toArray(value[key]).map((v: any) => this.parseItem(v))
					break
				default:
					linkbase[parsedKey] = utilType.toString(value[key])
					break
			}
		}

		return linkbase
	}

	private parseItemExtended(value: any): XbrlLinkbaseItemExtended {
		const item: XbrlLinkbaseItemExtended = {
			type: 'extended',
		}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as keyof Omit<XbrlLinkbaseItemExtended, 'type'>
			switch (parsedKey) {
				case 'loc':
				case 'calculationArc':
				case 'definitionArc':
				case 'labelArc':
				case 'presentationArc':
				case 'footnoteArc':
				case 'label':
				case 'footnote':
					item[parsedKey] = utilType.toArray(value[key]).map((v: any) => this.parseItem(v))
					break
				default:
					item[parsedKey] = utilType.toString(value[key])
					break
			}
		}

		return item
	}
}

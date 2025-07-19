/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
	XbrlLinkbase,
	XbrlLinkbaseItemArc,
	XbrlLinkbaseItemExtended,
	XbrlLinkbaseItemLocator,
	XbrlLinkbaseItemResource,
	XbrlLinkbaseItemSimple,
} from '../../../types'
import ObjectUtil from '../ObjectUtil'
import XMLParser from '../XMLParser'
import utilXbrl from './util-xbrl'

export default class LinkbaseParser {
	private readonly xmlParser: XMLParser
	private readonly objectUtil = new ObjectUtil()

	constructor(args?: { xmlParser?: XMLParser }) {
		const { xmlParser = new XMLParser() } = args ?? {}
		this.xmlParser = xmlParser
	}

	public parse(xml: string): XbrlLinkbase | null {
		const parsed = utilXbrl.extractXbrlObject(this.xmlParser.parse(xml))
		return this.parseLinkbaseDocument(parsed)
	}

	private parseLinkbaseDocument(value: any): XbrlLinkbase | null {
		value = utilXbrl.toObject(value)

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key)
			switch (parsedKey) {
				case 'linkbase':
					return this.parseLinkbase(value[key])
			}
		}

		// if linkbase is not found, try iterating through keys to find it
		let linkbase: XbrlLinkbase | null = null
		this.objectUtil.iterateKeysDeep(value, (d) => {
			const k = utilXbrl.parseKey(d.key)
			if (k === 'linkbase') {
				d.breakLoop()
				linkbase = this.parseLinkbase(d.value)
			}
		})

		return linkbase
	}

	private parseItem(
		value: any,
	): XbrlLinkbaseItemSimple | XbrlLinkbaseItemLocator | XbrlLinkbaseItemArc | XbrlLinkbaseItemResource {
		value = utilXbrl.toObject(value)
		const item: any = {}

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as
				| keyof XbrlLinkbaseItemSimple
				| keyof XbrlLinkbaseItemLocator
				| keyof XbrlLinkbaseItemArc
				| keyof XbrlLinkbaseItemResource

			switch (parsedKey) {
				case 'closed':
					item[parsedKey] = utilXbrl.toBoolean(value[key])
					break
				case 'priority':
				case 'order':
				case 'weight':
					item[parsedKey] = utilXbrl.toNumber(value[key])
					break
				default:
					item[parsedKey] = utilXbrl.toString(value[key])
					break
			}
		}

		return item
	}

	private parseLinkbase(value: any): XbrlLinkbase {
		value = utilXbrl.toObject(value)
		const linkbase: XbrlLinkbase = {}

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as keyof Omit<XbrlLinkbase, 'id'>
			switch (parsedKey) {
				case 'referenceLink':
				case 'labelLink':
				case 'presentationLink':
				case 'calculationLink':
				case 'definitionLink':
					linkbase[parsedKey] = utilXbrl.toArray(value[key]).map((v: any) => this.parseItemExtended(v))
					break
				case 'roleRef':
				case 'arcroleRef':
					linkbase[parsedKey] = utilXbrl.toArray(value[key]).map((v: any) => this.parseItem(v))
					break
				default:
					linkbase[parsedKey] = utilXbrl.toString(value[key])
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
			const parsedKey = utilXbrl.parseKey(key) as keyof Omit<XbrlLinkbaseItemExtended, 'type'>
			switch (parsedKey) {
				case 'loc':
				case 'calculationArc':
				case 'definitionArc':
				case 'labelArc':
				case 'presentationArc':
				case 'footnoteArc':
				case 'label':
				case 'footnote':
					item[parsedKey] = utilXbrl.toArray(value[key]).map((v: any) => this.parseItem(v))
					break
				default:
					item[parsedKey] = utilXbrl.toString(value[key])
					break
			}
		}

		return item
	}
}

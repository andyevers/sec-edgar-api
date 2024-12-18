/* eslint-disable @typescript-eslint/no-explicit-any */
import { XbrlContext, XbrlElement, XbrlInstance, XbrlUnit } from '../../../types/xbrl.type'
import XMLParser from '../XMLParser'
import utilType from './util-type'

export default class InstanceParser {
	private readonly xmlParser = new XMLParser()

	private parseContext(node: any): XbrlContext {
		const context = utilType.toObject(node)
		const id = utilType.toString(context['@_id'])

		const entity = utilType.toObject(context['xbrli:entity'] ?? context['entity'])
		const entityIdentifier = utilType.toObject(entity['xbrli:identifier'] ?? entity['identifier'])
		const entityIdentifierText = utilType.toString(entityIdentifier['#text'])
		const entityIdentifierScheme = utilType.toString(entityIdentifier['@_scheme'])
		const segment = utilType.toObject(entity['xbrli:segment'] ?? entity['segment'])

		const segmentExplicitMembers = utilType.toArray(segment['xbrldi:explicitMember'])
		const segmentTypedMembers = utilType.toArray(segment['xbrldi:typedMember'])

		const segments: { value: string; dimension: string; typedValue?: string }[] = []

		segmentTypedMembers.forEach((member: any) => {
			member = utilType.toObject(member)
			const dimension = member['@_dimension'] ?? ''
			segments.push({
				value: utilType.toString(member[`${dimension}.domain`]),
				dimension: utilType.toString(dimension),
			})
		})

		segmentExplicitMembers.forEach((member: any) => {
			member = utilType.toObject(member)
			segments.push({
				value: utilType.toString(member['#text']),
				dimension: utilType.toString(member['@_dimension']),
			})
		})

		const period = utilType.toObject(context['xbrli:period'] ?? context['period'])
		const periodObj: any = {}

		const startDate = period['xbrli:startDate'] ?? period['startDate']
		const endDate = period['xbrli:endDate'] ?? period['endDate']
		const instant = period['xbrli:instant'] ?? period['instant']

		if (startDate) {
			periodObj.startDate = utilType.toString(startDate)
		}
		if (endDate) {
			periodObj.endDate = utilType.toString(endDate)
		}
		if (instant) {
			periodObj.instant = utilType.toString(instant)
		}

		return {
			id,
			entity: {
				identifier: {
					value: entityIdentifierText,
					scheme: entityIdentifierScheme,
				},
				segment: segments,
			},
			period: periodObj,
		}
	}

	public parse(xml: string): XbrlInstance {
		const contentLower = xml.toLowerCase()

		const indexXbrlStart = contentLower.indexOf('<xbrl')
		const indexXbrlEnd = contentLower.lastIndexOf('</xbrl')
		const xbrlContent = xml.substring(indexXbrlStart, indexXbrlEnd + 7)

		if (indexXbrlStart === -1) {
			return { facts: [], contexts: [], units: [] }
		}

		const doc = this.xmlParser.parse(xbrlContent)
		const xbrl = doc.xbrl ?? (doc.XBRL as any)

		const contexts: XbrlContext[] = utilType
			.toArray(xbrl?.context ?? [])
			.map((context: any) => this.parseContext(context))

		const units: XbrlUnit[] = utilType.toArray(xbrl?.unit ?? []).map((unit: any) => ({
			id: unit['@_id'] ?? '',
			measure: unit['@_measure'] ?? '',
		}))

		const facts: XbrlElement[] = []

		for (const name in xbrl) {
			for (const element of utilType.toArray(xbrl[name])) {
				if (!element['@_contextRef']) continue

				const factElement: XbrlElement = { name, id: '', contextRef: '' }
				for (const key in element) {
					if (key.startsWith('@_')) {
						factElement[key.substring(2) as keyof XbrlElement] = element[key]
					} else if (key === '#text') {
						factElement.text = element[key]
					}
				}

				facts.push(factElement)
			}
		}

		return { facts, contexts, units }
	}
}

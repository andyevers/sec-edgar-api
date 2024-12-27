/* eslint-disable @typescript-eslint/no-explicit-any */
import type { XbrlContext, XbrlElement, XbrlInstance, XbrlUnit } from '../../../types/xbrl.type'
import XMLParser from '../XMLParser'
import utilXbrl from './util-xbrl'

export default class InstanceParser {
	private readonly xmlParser = new XMLParser()

	private parseContext(node: any): XbrlContext {
		const context = utilXbrl.toObject(node)
		const id = utilXbrl.toString(context['@_id'])

		const entity = utilXbrl.toObject(context['xbrli:entity'] ?? context['entity'])
		const entityIdentifier = utilXbrl.toObject(entity['xbrli:identifier'] ?? entity['identifier'])
		const entityIdentifierText = utilXbrl.toString(entityIdentifier['#text'])
		const entityIdentifierScheme = utilXbrl.toString(entityIdentifier['@_scheme'])
		const segment = utilXbrl.toObject(entity['xbrli:segment'] ?? entity['segment'])

		const segmentExplicitMembers = utilXbrl.toArray(segment['xbrldi:explicitMember'])
		const segmentTypedMembers = utilXbrl.toArray(segment['xbrldi:typedMember'])

		const segments: { value: string; dimension: string; typedValue?: string }[] = []

		segmentTypedMembers.forEach((member: any) => {
			member = utilXbrl.toObject(member)
			const dimension = member['@_dimension'] ?? ''
			segments.push({
				value: utilXbrl.toString(member[`${dimension}.domain`]),
				dimension: utilXbrl.toString(dimension),
			})
		})

		segmentExplicitMembers.forEach((member: any) => {
			member = utilXbrl.toObject(member)
			segments.push({
				value: utilXbrl.toString(member['#text']),
				dimension: utilXbrl.toString(member['@_dimension']),
			})
		})

		const period = utilXbrl.toObject(context['xbrli:period'] ?? context['period'])
		const periodObj: any = {}

		const startDate = period['xbrli:startDate'] ?? period['startDate']
		const endDate = period['xbrli:endDate'] ?? period['endDate']
		const instant = period['xbrli:instant'] ?? period['instant']

		if (startDate) {
			periodObj.startDate = utilXbrl.toString(startDate)
		}
		if (endDate) {
			periodObj.endDate = utilXbrl.toString(endDate)
		}
		if (instant) {
			periodObj.instant = utilXbrl.toString(instant)
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
		const xbrl = utilXbrl.extractXbrlObject(this.xmlParser.parse(xml))

		const contexts: XbrlContext[] = utilXbrl
			.toArray(xbrl?.context ?? xbrl?.['xbrli:context'] ?? [])
			.map((context: any) => this.parseContext(context))

		const units: XbrlUnit[] = utilXbrl.toArray(xbrl?.unit ?? []).map((unit: any) => ({
			id: unit['@_id'] ?? '',
			measure: unit['xbrli:measure']?.['#text'] ?? unit['measure']?.['#text'] ?? '',
		}))

		const factElements: XbrlElement[] = []

		for (const name in xbrl) {
			for (const element of utilXbrl.toArray(xbrl[name])) {
				if (!element['@_contextRef']) continue

				const factElement: XbrlElement = { name, id: '', contextRef: '' }
				for (const key in element) {
					if (key.startsWith('@_')) {
						factElement[key.substring(2) as keyof XbrlElement] = element[key]
					} else if (key === '#text') {
						factElement.text = element[key]
					}
				}

				factElements.push(factElement)
			}
		}

		return { factElements, contexts, units }
	}
}

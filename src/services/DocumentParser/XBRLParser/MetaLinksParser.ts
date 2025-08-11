import { XbrlMetaLinks } from '../../../types/metalinks.type'

/**
 * Parse MetaLinks.json
 */
export class MetaLinksParser {
	public parse(xml: string): XbrlMetaLinks | null {
		console.log({ xml })
		if (!xml) return null
		try {
			const numberKeys = new Set(['decimals', 'order'])
			const booleanKeys = new Set(['xsiNil', 'isDefault'])

			return JSON.parse(xml.substring(xml.indexOf('{'), xml.lastIndexOf('}') + 1), (key, value) => {
				if (numberKeys.has(key) && !isNaN(value)) {
					return Number(value)
				}
				if (booleanKeys.has(key)) {
					if (value === 'false') return false
					if (value === 'true') return true
				}
				return value
			})
		} catch {
			return null
		}
	}
}

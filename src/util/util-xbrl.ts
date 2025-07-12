import { XbrlLinkbase } from '../types/xbrl.type'

export function getLabelByTaxonomy(labelLinkbase: XbrlLinkbase) {
	const labelByTaxonomy: Record<string, string> = {}

	labelLinkbase.labelLink?.forEach((link) => {
		link.label?.forEach(({ label = '', text = '', role = '' }) => {
			const taxonomy = getTaxonomyFromId(label)

			// prefer terseLabel over regular label
			if (role.endsWith('terseLabel') || !labelByTaxonomy[taxonomy]) {
				labelByTaxonomy[taxonomy] = text
			}
		})
	})

	return labelByTaxonomy
}

export function getTaxonomyFromId(id: string) {
	return id.split('_').slice(1, 3).join(':')
}

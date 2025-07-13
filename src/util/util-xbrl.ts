import { XbrlLinkbase } from '../types/xbrl.type'

/**
 * Gets labels by taxonomy from the label linkbase. priority level: verboseLabel > terseLabel > label.
 */
export function getLabelByTaxonomy(labelLinkbase: XbrlLinkbase) {
	const labelByTaxonomy: Record<string, string> = {}
	const taxonomyWithVerboseLabels = new Set<string>()

	labelLinkbase.labelLink?.forEach((link) => {
		link.label?.forEach(({ label = '', text = '', role = '' }) => {
			const taxonomy = getTaxonomyFromId(label)

			// skip if verbose label already exists for this taxonomy
			if (taxonomyWithVerboseLabels.has(taxonomy)) {
				return
			}

			// label, terseLabel, or verboseLabel
			const labelType = role.substring(role.lastIndexOf('/') + 1) as 'label' | 'terseLabel' | 'verboseLabel'

			if (labelType === 'verboseLabel') {
				taxonomyWithVerboseLabels.add(taxonomy)
			}

			// prefer terseLabel over regular label
			if (!labelByTaxonomy[taxonomy] || labelType === 'terseLabel' || labelType === 'verboseLabel') {
				labelByTaxonomy[taxonomy] = text
			}
		})
	})

	return labelByTaxonomy
}

export function getTaxonomyFromId(id: string) {
	return id.split('_').slice(1, 3).join(':')
}

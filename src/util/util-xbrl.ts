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

function isPascaleCase(str: string) {
	const startsWithUpperCase = str && str[0].toLowerCase() !== str[0]
	return startsWithUpperCase && str.split('').some((c) => c.toLowerCase() === c)
}

const knownPrefixes: Record<string, boolean> = {
	'us-gaap': true,
	'ifrs-full': true,
	dei: true,
	srt: true,
	country: true,
}

export function getTaxonomyFromId(id: string) {
	const parts = id.split('_')
	const isLabelIndicatorPosition3 = parts[2] === 'lbl'
	const isKnownPrefixPosition1 = knownPrefixes[parts[0]] === true
	const isNameInPosition2 =
		parts.length <= 2 || isLabelIndicatorPosition3 || isKnownPrefixPosition1 || isPascaleCase(parts[1])

	return isNameInPosition2 ? parts.slice(0, 2).join(':') : parts.slice(1, 3).join(':')
}

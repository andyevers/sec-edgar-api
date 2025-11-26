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
			const labelType = role.substring(role.lastIndexOf('/') + 1) as
				| 'label'
				| 'terseLabel'
				| 'verboseLabel'
				| 'periodStartLabel'
				| 'periodEndLabel'

			// skip periodStartLabel. Used for beginning cash position, but overwrites end cash position.
			if (labelType === 'periodStartLabel') {
				return
			}

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

	const result = isNameInPosition2 ? parts.slice(0, 2).join(':') : parts.slice(1, 3).join(':')

	// this happens when the prefix is touching the concept name like "loc_us-gaapAssetsCurrent_lab".
	// The symbol "GAN" has this issue.
	if (result.startsWith('loc:')) {
		const idWithoutLoc = id.substring(4)
		const knownPrefix = Object.keys(knownPrefixes).find((prefix) => idWithoutLoc.startsWith(prefix))
		if (knownPrefix) {
			return `${knownPrefix}:${idWithoutLoc.substring(knownPrefix.length).split('_')[0]}`
		}
		// custom taxonomy, assume the first capital letter followed by a lowercase is the concept name. ex: GANAssetsCurrentCustomConcept.match(/([A-Z][a-z]+)/)
		const indexUpperFollowedByLower = idWithoutLoc.search(/[a-z]/) - 1
		const customPrefix = idWithoutLoc.substring(0, indexUpperFollowedByLower - 1)
		const conceptName = idWithoutLoc.substring(indexUpperFollowedByLower - 1).split('_')[0]
		return `${customPrefix}:${conceptName}`
	}

	return result
}

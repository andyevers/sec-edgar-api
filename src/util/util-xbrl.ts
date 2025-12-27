import { XbrlLinkbase } from '../types/xbrl.type'

export function getLabelsByTypeByTaxonomy(labelLinkbase: XbrlLinkbase) {
	const labelsByTypeByTaxonomy: Record<string, Record<string, string>> = {}

	labelLinkbase?.labelLink?.forEach((link) => {
		link.label?.forEach(({ label = '', text = '', role = '' }) => {
			const taxonomy = getTaxonomyFromId(label)
			const labelType = role.substring(role.lastIndexOf('/') + 1)

			labelsByTypeByTaxonomy[taxonomy] ??= {}
			labelsByTypeByTaxonomy[taxonomy][labelType] = text
		})
	})

	return labelsByTypeByTaxonomy
}

/**
 * The primary label based on priority: verboseLabel > terseLabel > label > periodEndLabel > first available label (excluding periodStartLabel)
 *
 * @param labelsByType The result of getLabelsByTypeByTaxonomy[key]
 */
export function getPrimaryLabel(labelsByType: Record<string, string>) {
	const preferredLabel =
		labelsByType.verboseLabel || labelsByType.terseLabel || labelsByType.label || labelsByType.periodEndLabel

	if (preferredLabel) return preferredLabel

	// return the first available label that is not periodStartLabel
	return Object.entries(labelsByType).find(([k, v]) => k !== 'periodStartLabel' && v.length > 0)?.[1] ?? ''
}

/**
 * The primary documentation based on priority: documentation > longest available label
 *
 * @param labelsByType The result of getLabelsByTypeByTaxonomy[key]
 */
export function getPrimaryDocumentation(labelsByType: Record<string, string>) {
	if (labelsByType.documentation) return labelsByType.documentation
	const validKeys = Object.keys(labelsByType).filter((key) => key !== 'periodStartLabel')
	return validKeys.reduce((acc, curr) => (acc.length > curr.length ? acc : curr), '')
}

/**
 * Gets labels by taxonomy from the label linkbase. priority level: verboseLabel > terseLabel > label.
 */
export function getLabelByTaxonomy(labelLinkbase: XbrlLinkbase) {
	const labelByTaxonomy: Record<string, string> = {}
	const labelsByTypeByTaxonomy = getLabelsByTypeByTaxonomy(labelLinkbase)

	for (const taxonomy in labelsByTypeByTaxonomy) {
		labelByTaxonomy[taxonomy] = getPrimaryLabel(labelsByTypeByTaxonomy[taxonomy])
	}

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
		const customPrefix = idWithoutLoc.substring(0, indexUpperFollowedByLower)
		const conceptName = idWithoutLoc.substring(indexUpperFollowedByLower).split('_')[0]
		return `${customPrefix}:${conceptName.replace(/'|"/g, '')}`
	}

	return result.replace(/'|"/g, '')
}

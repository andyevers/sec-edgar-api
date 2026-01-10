import { DocumentXbrlResult } from '../services/DocumentParser/parsers/parse-xbrl'
import { XbrlFilingSummaryReport } from '../services/DocumentParser/XBRLParser/FilingSummaryParser'
import { FactItemExtended, XbrlLinkbase, XbrlLinkbaseItemArc, XbrlLinkbaseItemLocator } from '../types'

export interface XbrlFilingSummaryReportWithTrees extends XbrlFilingSummaryReport {
	calculationTree: TreeNode[]
	presentationTree: TreeNode[]
}

export type MemberInclusionRule = 'always' | 'inReportsWherePresent' | 'never'
export type RowLabelType = 'preferredLabel' | 'descriptiveLabel'

export interface TreeNode {
	label: string
	value: number | string | null
	unit: string
	period: number
	key: string
	isPeriodStart: boolean
	weight: number
	members?: MemberFact[]
	children?: TreeNode[]
}

export interface MemberFact {
	segments: { dimension: string; value: string; label: string }[]
	value: string | number | null
}

interface HierarchyItem extends TreeNode {
	id: string
	parentId: string | null
	parentKey: string | null
	order: number
}

function hrefToKey(href: string): string {
	const fragment = href.split('#').pop() || ''
	return fragment.replace('_', ':')
}

function getLabelTypeByHref(linkbase?: XbrlLinkbase) {
	const labelLink = linkbase?.labelLink?.[0]
	const labelLocByHref = new Map(labelLink?.loc?.map((l) => [l.href, l]))
	const labelArcByFrom = new Map(labelLink?.labelArc?.map((l) => [l.from, l]))

	const labelByTypeByLabelId = new Map<string, Record<string, string>>()
	labelLink?.label?.forEach((l) => {
		const bucket = labelByTypeByLabelId.get(l.label!) ?? labelByTypeByLabelId.set(l.label!, {}).get(l.label!)!
		bucket[l.type.substring(l.type.lastIndexOf('/') + 1)] = l.text!
	})

	const labelByTypeByHref = new Map<string, Record<string, string>>()
	labelLocByHref.forEach((locator, href) => {
		labelByTypeByHref.set(href, labelByTypeByLabelId.get(labelArcByFrom.get(locator.label)?.to ?? '') ?? {})
	})

	return labelByTypeByHref
}

function getBestLabel(params: {
	href: string
	preferredLabel?: string
	labelByHref: Map<string, Record<string, string>>
}) {
	const { href, labelByHref, preferredLabel } = params

	const bucket = labelByHref.get(href)
	if (!bucket) return null

	// try getting preferred label
	const preferredLabelType = preferredLabel?.substring(preferredLabel?.lastIndexOf('/') + 1)
	if (preferredLabelType && bucket[preferredLabelType]) return bucket[preferredLabelType]

	// if not provided, choose first of these.
	for (const type of ['verboseLabel', 'terseLabel', 'label', 'periodEndLabel']) {
		if (bucket[type]) return bucket[type]
	}

	// return whatever is left
	return Object.values(bucket)[0] ?? null
}

function getPeriodFacts(params: {
	factsByConcept: Map<string, FactItemExtended[]>
	conceptKey: string
	isPeriodStart: boolean
}) {
	const { factsByConcept, conceptKey, isPeriodStart } = params
	const facts = factsByConcept.get(conceptKey) ?? []
	const primaryFacts = facts.filter((f) => f.isCurrentPeriod)
	if (!isPeriodStart || primaryFacts.length === 0) return primaryFacts

	const primaryFact = primaryFacts[0]
	const maxEnd = facts.reduce((max, f) => (f.end > max && f.end < primaryFact.end ? f.end : max), '0000-00-00')

	return facts.filter((f) => !f.isCurrentPeriod && f.end === maxEnd)
}

function extractMemberFacts(
	facts: FactItemExtended[],
	memberInclusionRule: MemberInclusionRule,
	allowedMembers?: Set<string>,
) {
	if (memberInclusionRule === 'never') return []

	const allMembers = facts
		.filter((f) => (f.segments?.length ?? 0) > 0)
		.map((f) => ({
			value: f.value,
			segments: f.segments!.map((s) => ({ dimension: s.dimension, value: s.value, label: f.label })),
		}))

	if (memberInclusionRule === 'always') return allMembers

	return allMembers.filter((m) =>
		m.segments?.every((s) => allowedMembers?.has(s.value) && allowedMembers?.has(s.dimension)),
	)
}

function extractPrimaryFact(facts: FactItemExtended[]) {
	return facts.find((f) => !(f.segments?.length ?? 0)) ?? null
}

function buildTemplateHierarchyFlat(params: {
	arcs: XbrlLinkbaseItemArc[]
	locByLabel: Map<string, XbrlLinkbaseItemLocator>
	labelByHref: Map<string, Record<string, string>>
	factsByConcept: Map<string, FactItemExtended[]>
	allowedMembers: Set<string>
	memberInclusionRule: MemberInclusionRule
	rowLabelType: RowLabelType
	disablePeriodStartFacts: boolean
}) {
	const {
		arcs,
		labelByHref,
		locByLabel,
		factsByConcept,
		allowedMembers,
		memberInclusionRule,
		rowLabelType,
		disablePeriodStartFacts,
	} = params

	const itemsById = new Map<string, HierarchyItem>()

	for (const arc of arcs) {
		const hrefFrom = locByLabel.get(arc.from)?.href ?? ''
		const hrefTo = locByLabel.get(arc.to)?.href ?? ''

		const keyFrom = hrefToKey(hrefFrom)
		const keyTo = hrefToKey(hrefTo)

		const isPeriodStart = arc.preferredLabel?.endsWith('periodStartLabel') ?? false

		if (isPeriodStart && disablePeriodStartFacts) {
			continue
		}

		if (!itemsById.has(arc.from)) {
			const periodFactsFrom = getPeriodFacts({ conceptKey: keyFrom, factsByConcept, isPeriodStart })
			const membersFrom = extractMemberFacts(periodFactsFrom, memberInclusionRule, allowedMembers)
			const primaryFactFrom = extractPrimaryFact(periodFactsFrom)

			itemsById.set(arc.from, {
				id: arc.from,
				parentId: null,
				key: keyFrom,
				parentKey: null,
				weight: 1,
				order: 0,
				label:
					getBestLabel({
						href: hrefFrom,
						labelByHref,
						preferredLabel: rowLabelType === 'preferredLabel' ? arc.preferredLabel : undefined,
					}) ?? keyFrom,
				isPeriodStart,
				period: primaryFactFrom?.period || 0,
				value: primaryFactFrom?.value ?? null,
				unit: primaryFactFrom?.unit ?? '',
				members: membersFrom,
				children: [],
			})
		}

		const periodFactsTo = getPeriodFacts({ conceptKey: keyTo, factsByConcept, isPeriodStart })
		const membersTo = extractMemberFacts(periodFactsTo, memberInclusionRule, allowedMembers)
		const primaryFactTo = extractPrimaryFact(periodFactsTo)

		const hierarchyTo: HierarchyItem = {
			id: arc.to,
			parentId: arc.from,
			key: keyTo,
			parentKey: arc.from ? hrefToKey(hrefFrom) : null,
			weight: arc.weight || 1,
			order: arc.order || 0,
			label:
				getBestLabel({
					href: hrefTo,
					labelByHref,
					preferredLabel: rowLabelType === 'preferredLabel' ? arc.preferredLabel : undefined,
				}) ?? keyTo,
			isPeriodStart,
			period: primaryFactTo?.period || 0,
			value: primaryFactTo?.value ?? null,
			unit: primaryFactTo?.unit ?? '',
			members: membersTo,
			children: [],
		}

		if (!itemsById.has(arc.to)) {
			itemsById.set(arc.to, hierarchyTo)
		} else {
			Object.assign(itemsById.get(arc.to)!, hierarchyTo)
		}

		itemsById.get(arc.from)!.children!.push(itemsById.get(arc.to)!)
	}

	return itemsById
}

function deepNestByKeys(itemsById: Map<string, HierarchyItem>): Map<string, HierarchyItem> {
	const itemsWithChildrenByKey = new Map<string, HierarchyItem>()

	itemsById.forEach((item) => {
		const currentItem = itemsWithChildrenByKey.get(item.key)
		if (!currentItem && item.children?.length) {
			itemsWithChildrenByKey.set(item.key, item)
		}
	})

	itemsById.forEach((item) => {
		item.children?.forEach((child, i) => {
			const currentItem = itemsWithChildrenByKey.get(child.key)
			if (!child.children?.length && currentItem) {
				item.children![i] = currentItem
				currentItem.parentId = item.id
				currentItem.parentKey = item.key
			}
		})
	})

	return itemsById
}

function hierarchyToTree(itemsById: Map<string, HierarchyItem>): TreeNode[] {
	itemsById.forEach((item) => {
		if (item.parentId) {
			itemsById.delete(item.id)
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const itemUntyped = item as any
		delete itemUntyped.id
		delete itemUntyped.parentId
		delete itemUntyped.parentKey
		delete itemUntyped.order
		if (itemUntyped.children?.length === 0) delete itemUntyped.children
		if (itemUntyped.members?.length === 0) delete itemUntyped.members
	})

	return Array.from(itemsById.values())
}

export interface BuildReportTreesParams {
	xbrlJson: DocumentXbrlResult

	/**
	 * Where members should be included in the tree nodes.
	 *
	 * @default 'inReportsWherePresent'
	 */
	memberInclusionRule?: MemberInclusionRule

	/**
	 * Which label type to use for row labels.
	 *
	 * @default 'preferredLabel'
	 */
	rowLabelType?: RowLabelType

	/**
	 * Disable inclusion of period start facts in the tree.
	 *
	 * @default false
	 */
	disablePeriodStartFacts?: boolean
}

export function buildReportTrees(params: BuildReportTreesParams): XbrlFilingSummaryReportWithTrees[] {
	const {
		xbrlJson,
		memberInclusionRule = 'inReportsWherePresent',
		rowLabelType = 'preferredLabel',
		disablePeriodStartFacts = false,
	} = params
	const filingSummary = xbrlJson.filingSummary

	if (!filingSummary) return []

	const labelByHref = getLabelTypeByHref(xbrlJson.linkbaseLabel?.xbrl)
	const factsByConcept = new Map<string, FactItemExtended[]>()
	xbrlJson.facts.forEach((fact) => {
		const bucket = factsByConcept.get(fact.name) ?? factsByConcept.set(fact.name, []).get(fact.name)!
		bucket.push(fact)
	})

	const calculationLinks = xbrlJson.linkbaseCalculation?.xbrl?.calculationLink ?? []
	const presentationLinks = xbrlJson.linkbasePresentation?.xbrl?.presentationLink ?? []

	// Iterate through the xbrl reports and build tree structures
	const reports: XbrlFilingSummaryReportWithTrees[] = filingSummary.reports.map((report) => {
		const calculationLinksReport = calculationLinks.filter((link) => link.role === report.role)
		const presentationLinksReport = presentationLinks.filter((link) => link.role === report.role)

		const allowedMembers = new Set<string>()
		presentationLinksReport.forEach((presentationLink) => {
			const locatorByLabelPres = new Map(presentationLink?.loc?.map((l) => [l.label, l]) ?? [])
			presentationLink?.presentationArc?.forEach((arc) => {
				allowedMembers.add(hrefToKey(locatorByLabelPres.get(arc.to)?.href ?? ''))
				allowedMembers.add(hrefToKey(locatorByLabelPres.get(arc.from)?.href ?? ''))
			})
		})

		const calculationTreeNodes: TreeNode[] = []
		const presentationTreeNodes: TreeNode[] = []

		const calculationHierarchiesFlat: Map<string, HierarchyItem>[] = []
		const presentationHierarchiesFlat: Map<string, HierarchyItem>[] = []

		calculationLinksReport.forEach((calculationLink) => {
			const locatorByLabelCalc = new Map(calculationLink?.loc?.map((l) => [l.label, l]) ?? [])
			const hierarchyCalc = buildTemplateHierarchyFlat({
				arcs: calculationLink?.calculationArc || [],
				labelByHref,
				locByLabel: locatorByLabelCalc,
				factsByConcept,
				allowedMembers,
				memberInclusionRule,
				rowLabelType,
				disablePeriodStartFacts,
			})

			calculationHierarchiesFlat.push(hierarchyCalc)
		})

		presentationLinksReport.forEach((presentationLink) => {
			const locatorByLabelPres = new Map(presentationLink?.loc?.map((l) => [l.label, l]) ?? [])
			const hierarchyPres = buildTemplateHierarchyFlat({
				arcs: presentationLink?.presentationArc || [],
				labelByHref,
				locByLabel: locatorByLabelPres,
				factsByConcept,
				allowedMembers,
				memberInclusionRule,
				rowLabelType,
				disablePeriodStartFacts,
			})

			presentationHierarchiesFlat.push(hierarchyPres)
		})

		const labelByKey = new Map<string, string>()
		presentationHierarchiesFlat.forEach((hierarchyPres) => {
			hierarchyPres.forEach((item) => labelByKey.set(item.key, item.label))
		})

		// Need to add member labels
		const mapMembers = (hierarchyFlat: Map<string, HierarchyItem>) => {
			hierarchyFlat.forEach((item) => {
				if (!item.members) return
				item.members = item.members.filter((m) => m.segments?.every((s) => labelByKey.has(s.value)))
				item.members?.forEach((member) => {
					member.segments.forEach((segment) => {
						segment.label = labelByKey.get(segment.value) || segment.value
					})
				})
			})
		}

		presentationHierarchiesFlat.forEach((hierarchyPres) => {
			mapMembers(hierarchyPres)
			presentationTreeNodes.push(...hierarchyToTree(hierarchyPres))
		})
		calculationHierarchiesFlat.forEach((hierarchyCalc) => {
			mapMembers(hierarchyCalc)
			calculationTreeNodes.push(...hierarchyToTree(deepNestByKeys(hierarchyCalc)))
		})

		return {
			...report,
			calculationTree: calculationTreeNodes,
			presentationTree: presentationTreeNodes,
		}
	})

	return reports
}

export interface TraverseTreeNodeData<T extends AnyTreeNode> {
	node: T
	parentNode: T | null
	/** Root level = 0 */
	depth: number
}

interface AnyTreeNode {
	children?: AnyTreeNode[]
}

/**
 * Traverse through a tree structure (depth first)
 */
export function traverseTree<T extends AnyTreeNode>(rootNodes: T[], callback: (data: TraverseTreeNodeData<T>) => void) {
	const traverse = (node: T, parentNode: T | null, depth: number) => {
		callback({ node, parentNode, depth })
		node.children?.forEach((child) => traverse(child as T, node, depth + 1))
	}
	rootNodes.forEach((rootNode) => traverse(rootNode, null, 0))
}

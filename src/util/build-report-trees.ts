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
			const existing = itemsById.get(arc.to)!
			// A concept can appear as `from` in earlier arcs (we accumulate
			// `children` via the `push` below) and as `to` in a later arc. The
			// fresh `hierarchyTo` always has `children: []`; a blind
			// `Object.assign` would clear already-linked children. Example:
			// pretax is created as a parent, adds Operating, then the same
			// pretax is attached under Net income — the second `hierarchyTo`
			// for pretax would wipe [Operating, Nonop] down to [].
			const priorChildren = existing.children
			Object.assign(existing, hierarchyTo)
			if (priorChildren && priorChildren.length > 0) {
				existing.children = priorChildren
			}
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

	/**
	 * Stitch disconnected calculation islands by value rollup.
	 *
	 * Many filers define calculation arcs in isolated groups rather than a
	 * single connected tree. When enabled, a leaf whose value equals the
	 * signed sum of orphan roots is expanded to parent those orphans,
	 * producing a deeper connected tree.
	 *
	 * @default false
	 */
	stitchCalcIslands?: boolean
}

export function buildReportTrees(params: BuildReportTreesParams): XbrlFilingSummaryReportWithTrees[] {
	const {
		xbrlJson,
		memberInclusionRule = 'inReportsWherePresent',
		rowLabelType = 'preferredLabel',
		disablePeriodStartFacts = false,
		stitchCalcIslands = false,
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
			calculationTree: stitchCalcIslands
				? stitchCalcIslandsByValueRollup(calculationTreeNodes)
				: calculationTreeNodes,
			presentationTree: presentationTreeNodes,
		}
	})

	return reports
}

// Calc-island stitching helpers

function stripNamespace(key: string): string {
	const colonIdx = key.indexOf(':')
	if (colonIdx !== -1) return key.slice(colonIdx + 1)
	const underscoreIdx = key.indexOf('_')
	if (underscoreIdx !== -1) return key.slice(underscoreIdx + 1)
	return key
}

function numericValue(node: TreeNode): number | null {
	if (typeof node.value === 'number' && isFinite(node.value)) return node.value
	if (typeof node.value === 'string') {
		const parsed = Number(node.value)
		if (isFinite(parsed)) return parsed
	}
	return null
}

const STITCH_EXCLUDED_UNITS = new Set(['shares', 'usdPerShare'])

function isExcludedStitchRoot(node: TreeNode): boolean {
	return STITCH_EXCLUDED_UNITS.has(node.unit)
}

function collectLeaves(node: TreeNode): TreeNode[] {
	if (!node.children?.length) return [node]
	const leaves: TreeNode[] = []
	for (const child of node.children) leaves.push(...collectLeaves(child))
	return leaves
}

function collectNonLeafValues(root: TreeNode): Set<number> {
	const values = new Set<number>()
	function walk(node: TreeNode) {
		if (node.children?.length) {
			const v = numericValue(node)
			if (v !== null) values.add(v)
			for (const child of node.children) walk(child)
		}
	}
	walk(root)
	return values
}

function findLeafByKey(node: TreeNode, key: string): TreeNode | null {
	if (node.key === key && (!node.children || node.children.length === 0)) return node
	for (const child of node.children ?? []) {
		const found = findLeafByKey(child, key)
		if (found) return found
	}
	return null
}

function findLeafByKeyInRoots(roots: TreeNode[], key: string): TreeNode | null {
	for (const root of roots) {
		const found = findLeafByKey(root, key)
		if (found) return found
	}
	return null
}

function popcount(x: number): number {
	let c = 0
	while (x) {
		c += x & 1
		x >>= 1
	}
	return c
}

/**
 * Find a subset of `candidates` whose values sum to `target` within
 * tolerance, trying both +/- signs for each candidate (disconnected orphan
 * roots have no parent arc to indicate add vs subtract).
 *
 * Complexity is O(3^n) — for each candidate we try: excluded, +value,
 * −value.  With n ≤ 10 that's ≤ 59 049 iterations.
 */
function findSubsetSummingTo(candidates: TreeNode[], target: number): TreeNode[] | null {
	const n = candidates.length
	if (n > 10) return null

	const values: number[] = []
	for (const c of candidates) {
		const v = numericValue(c)
		if (v === null || v === 0) values.push(NaN)
		else values.push(v)
	}

	for (let mask = 3; mask < 1 << n; mask++) {
		if (popcount(mask) < 2) continue

		const indices: number[] = []
		let allValid = true
		for (let i = 0; i < n; i++) {
			if (mask & (1 << i)) {
				if (isNaN(values[i]!)) {
					allValid = false
					break
				}
				indices.push(i)
			}
		}
		if (!allValid) continue

		const k = indices.length
		const signCombos = 1 << k
		for (let s = 0; s < signCombos; s++) {
			let sum = 0
			for (let j = 0; j < k; j++) {
				sum += s & (1 << j) ? -values[indices[j]!]! : values[indices[j]!]!
			}
			if (sum === target) {
				return indices.map((i) => candidates[i]!)
			}
		}
	}
	return null
}

/**
 * Reject a stitch when every orphan root's value already appears on a
 * non-leaf node in the target tree (redundant variant).
 */
function orphansAlreadyRepresented(orphans: TreeNode[], nonLeafValues: Set<number>): boolean {
	return orphans.every((o) => {
		const v = numericValue(o)
		return v !== null && nonLeafValues.has(v)
	})
}

interface ValueRollupStitch {
	leafKey: string
	orphans: TreeNode[]
}

function findBestValueRollupStitch(roots: TreeNode[], candidateOrphans: TreeNode[]): ValueRollupStitch | null {
	for (const root of roots) {
		const leaves = collectLeaves(root)
		const nonLeafValues = collectNonLeafValues(root)

		for (const leaf of leaves) {
			const leafVal = numericValue(leaf)
			if (leafVal === null || leafVal === 0) continue

			const orphansForThisRoot = candidateOrphans.filter(
				(o) => stripNamespace(o.key) !== stripNamespace(root.key),
			)
			if (orphansForThisRoot.length < 2) continue

			const match = findSubsetSummingTo(orphansForThisRoot, leafVal)
			if (match && match.length >= 2) {
				if (orphansAlreadyRepresented(match, nonLeafValues)) continue
				return { leafKey: leaf.key, orphans: match }
			}
		}
	}
	return null
}

function stitchCalcIslandsByValueRollup(roots: TreeNode[]): TreeNode[] {
	if (roots.length < 3) return roots

	const candidateOrphans = roots.filter((r) => {
		if (isExcludedStitchRoot(r)) return false
		if (numericValue(r) === null && !r.children?.length) return false
		return true
	})
	if (candidateOrphans.length < 2) return roots

	const best = findBestValueRollupStitch(roots, candidateOrphans)
	if (!best) return roots

	function cloneNode(n: TreeNode): TreeNode {
		return { ...n, children: n.children ? n.children.map(cloneNode) : undefined }
	}

	const clonedRoots = roots.map(cloneNode)
	const targetLeaf = findLeafByKeyInRoots(clonedRoots, best.leafKey)
	if (!targetLeaf) return roots

	const attachNorms = new Set(best.orphans.map((n) => stripNamespace(n.key)))
	const clonedOrphans = best.orphans.map((n) => cloneNode(n))
	targetLeaf.children = [...(targetLeaf.children ?? []), ...clonedOrphans]

	return clonedRoots.filter((r) => !attachNorms.has(stripNamespace(r.key)))
}

// Tree traversal utility
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

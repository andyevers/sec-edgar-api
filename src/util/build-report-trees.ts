import { DocumentXbrlResult } from '../services/DocumentParser/parsers/parse-xbrl'
import { XbrlFilingSummaryReport } from '../services/DocumentParser/XBRLParser/FilingSummaryParser'
import { FactItemExtended, XbrlLinkbase, XbrlLinkbaseItemArc, XbrlLinkbaseItemLocator } from '../types'
import { resolveConceptTreeValue } from './member-fact-rollup'

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
	/**
	 * When set, this row was restructured into the calculation tree from the
	 * presentation linkbase by
	 * {@link mergePresentationOnlyNodesIntoCalculation} (only populated when
	 * {@link MergePresentationIntoCalculationOptions.markEnrichedFromPresentation}
	 * is enabled).
	 */
	enrichedFromPresentation?: boolean
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
	rollupParentValueFromSingleAxisMembers: boolean
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
		rollupParentValueFromSingleAxisMembers,
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
				value: resolveConceptTreeValue({
					primary: primaryFactFrom,
					members: membersFrom,
					rollupParentValueFromSingleAxisMembers,
				}),
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
			value: resolveConceptTreeValue({
				primary: primaryFactTo,
				members: membersTo,
				rollupParentValueFromSingleAxisMembers,
			}),
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
	 * When true (default), a concept with no primary (non-dimensional) numeric
	 * fact derives its row value from its dimensional members. Members are
	 * grouped by their ordered axis (dimension) signature, which also keeps a
	 * 2-segment row from being summed together with a 3-segment row. The row
	 * value is the member sum when either a single axis group is present, or
	 * multiple axis groups each sum to the **same** value (independent
	 * breakdowns of the same total agree). Controlled by
	 * {@link DocumentXbrlResult.rollupParentValueFromSingleAxisMembers} unless
	 * overridden here.
	 */
	rollupParentValueFromSingleAxisMembers?: boolean

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

	/**
	 * Restructure presentation-only nodes (concepts present in the
	 * presentation linkbase but absent from the calculation linkbase) into
	 * each report's calculation tree, so the calculation tree is a superset
	 * that downstream consumers (mapping, UI visualization) can treat as the
	 * single source of structure. Applied uniformly to every report via
	 * {@link mergePresentationOnlyNodesIntoCalculation}.
	 *
	 * @default false
	 */
	appendPresentationOnlyNodesToCalculationTree?: boolean

	/**
	 * Options forwarded to {@link mergePresentationOnlyNodesIntoCalculation}
	 * when {@link appendPresentationOnlyNodesToCalculationTree} is enabled.
	 */
	presentationMergeOptions?: MergePresentationIntoCalculationOptions
}

export function buildReportTrees(params: BuildReportTreesParams): XbrlFilingSummaryReportWithTrees[] {
	const {
		xbrlJson,
		memberInclusionRule = 'inReportsWherePresent',
		rowLabelType = 'preferredLabel',
		disablePeriodStartFacts = false,
		stitchCalcIslands = false,
		appendPresentationOnlyNodesToCalculationTree = false,
		presentationMergeOptions,
		rollupParentValueFromSingleAxisMembers: rollupOverride,
	} = params
	const rollupParentValueFromSingleAxisMembers =
		rollupOverride !== undefined
			? rollupOverride
			: xbrlJson.rollupParentValueFromSingleAxisMembers !== false
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
				rollupParentValueFromSingleAxisMembers,
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
				rollupParentValueFromSingleAxisMembers,
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

	if (appendPresentationOnlyNodesToCalculationTree) {
		return reports.map((report) =>
			mergePresentationOnlyNodesIntoCalculation(report, presentationMergeOptions),
		)
	}

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

function collectAllKeys(node: TreeNode, out: Set<string>): void {
	out.add(stripNamespace(node.key))
	for (const child of node.children ?? []) collectAllKeys(child, out)
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

	// Collect all keys already in the target tree to prevent duplicates
	// and circular references after stitching.
	const targetKeys = new Set<string>()
	for (const root of clonedRoots) collectAllKeys(root, targetKeys)

	const safeOrphans: TreeNode[] = []
	for (const orphan of best.orphans) {
		const orphanKeys = new Set<string>()
		collectAllKeys(orphan, orphanKeys)
		let overlap = false
		orphanKeys.forEach((ok) => {
			if (targetKeys.has(ok)) overlap = true
		})
		if (!overlap) safeOrphans.push(cloneNode(orphan))
	}
	if (safeOrphans.length === 0) return roots

	targetLeaf.children = [...(targetLeaf.children ?? []), ...safeOrphans]

	const attachedNorms = new Set(safeOrphans.map((n) => stripNamespace(n.key)))
	return clonedRoots.filter((r) => !attachedNorms.has(stripNamespace(r.key)))
}

// ---------------------------------------------------------------------------
// Presentation → calculation merge
//
// Restructure presentation-only rows (concepts in the presentation linkbase
// but absent from calculation) into the calculation tree, so the calculation
// tree becomes a superset usable directly for mapping/visualization. Many
// filers leave a subtotal (e.g. `us-gaap:AssetsCurrent`) as a childless calc
// leaf while the presentation linkbase carries the detail lines under an
// abstract grouping; this re-roots those detail lines under the subtotal and
// appends genuinely presentation-only sections as new roots.
// ---------------------------------------------------------------------------

/** Tolerance: presentation-only leaves at or below this magnitude are treated as zero. */
const PRESENTATION_LEAF_NONZERO_EPS = 1e-9

export interface MergePresentationIntoCalculationOptions {
	/**
	 * When true, drop presentation-only leaves with no finite numeric value, or
	 * whose absolute value is at or below {@link PRESENTATION_LEAF_NONZERO_EPS}.
	 */
	requireNonZeroPresentationLeaves?: boolean
	/**
	 * When true, set {@link TreeNode.enrichedFromPresentation} on rows merged
	 * from the presentation linkbase (value-matched rollups + appended roots).
	 */
	markEnrichedFromPresentation?: boolean
	/**
	 * When true, skip the sibling-sum rollup inference that re-roots
	 * presentation detail lines under existing *calculation* subtotals
	 * ({@link inferPresentationChildren}). Only the presentation-only roots
	 * are appended. Use for statements (e.g. cash flow) whose calculation
	 * backbone is already complete for the sections it covers — inferring
	 * extra rollups there reshapes the operating/financing branches.
	 */
	appendRootsOnly?: boolean
	/**
	 * When true, resolve the hierarchy inside appended presentation-only
	 * subtrees by folding an abstract grouping (`…Abstract`) onto its
	 * concrete subtotal twin (`…`), nesting the abstract's other children
	 * under that twin so a subtotal seeded to the twin can distribute them.
	 * Folded children receive an inferred cash-flow sign weight (outflow
	 * concepts → −1, inflow concepts → +1) so leaf values carry the right
	 * sign. See {@link resolveAbstractTwinSubtotals}.
	 */
	resolveAbstractTwinSubtotals?: boolean
	/**
	 * When true, re-root a grand-total leaf under its abstract grouping when
	 * the trailing subtotals of the abstract's other children reconcile to the
	 * total. Balance sheets (esp. utilities) commonly nest the asset hierarchy
	 * as `AssetsAbstract → { AssetsCurrentAbstract, …NetAbstract,
	 * …NoncurrentAbstract, Assets }` with no calculation arcs from `Assets`;
	 * this turns `Assets` into a real parent so propagation has an asset
	 * backbone. Value-validated — only fires when the rollup actually sums.
	 * See {@link rerootValidatedAbstractTotals}.
	 */
	rerootValidatedAbstractTotals?: boolean
}

/**
 * Preserve calculation as the backbone while making presentation-only rows
 * visible to downstream consumers. The presentation branch is pruned to
 * concepts absent from calculation, with abstract/container ancestors retained
 * only as needed to keep sibling context.
 *
 * Optional `requireNonZeroPresentationLeaves` (for UI): include only
 * presentation-only leaves that carry a non‑zero numeric fact — reduces noise
 * from empty XBRL placeholders.
 */
export function mergePresentationOnlyNodesIntoCalculation(
	report: XbrlFilingSummaryReportWithTrees,
	options?: MergePresentationIntoCalculationOptions,
): XbrlFilingSummaryReportWithTrees {
	const calculationTree = report.calculationTree ?? []
	const presentationTree = report.presentationTree ?? []
	if (calculationTree.length === 0 || presentationTree.length === 0) return report

	const originalCalcKeys = new Set(flattenTreeNodes(calculationTree).map((n) => stripNamespace(n.key)))
	const inferFlags: InferredCloneFlags = {
		options: options?.markEnrichedFromPresentation === true ? options : undefined,
		originalCalcKeys,
	}

	const presentationContexts = buildPresentationContexts(presentationTree)
	const calculationWithInferredRollups = options?.appendRootsOnly
		? deepCloneNodes(calculationTree)
		: calculationTree.map((node) =>
				cloneWithInferredPresentationChildren(node, presentationContexts, new Set(), inferFlags, false),
		  )
	const calcKeys = new Set(flattenTreeNodes(calculationWithInferredRollups).map((node) => stripNamespace(node.key)))
	// Re-root grand-total leaves under their abstract grouping *before*
	// pruning: the reconciliation needs each component subtotal's value, and
	// pruning removes calc-native subtotals (e.g. AssetsCurrent) that would
	// otherwise make the sum check fail.
	const restructuredPresentationTree = options?.rerootValidatedAbstractTotals
		? presentationTree.map(rerootValidatedAbstractTotals)
		: presentationTree
	const presentationOnlyRoots = restructuredPresentationTree
		.map((node) => prunePresentationOnly(node, calcKeys, options, originalCalcKeys))
		.filter((node): node is TreeNode => node !== null)
		.map((node) => (options?.resolveAbstractTwinSubtotals ? resolveAbstractTwinSubtotals(node) : node))

	const merged = calculationWithInferredRollups.concat(presentationOnlyRoots)
	// Complete the re-root: a re-rooted total (e.g. `Assets`) left an empty
	// abstract placeholder (`AssetsCurrentAbstract`) where the real subtotal
	// (`AssetsCurrent`) lives as a separate calc-native root. Adopt that root
	// under the total when the children then fully reconcile.
	const finalTree = options?.rerootValidatedAbstractTotals ? adoptCalcRootsUnderRerootedTotals(merged) : merged

	return {
		...report,
		calculationTree: finalTree,
	}
}

function flattenTreeNodes(tree: TreeNode[]): TreeNode[] {
	const result: TreeNode[] = []
	for (const node of tree) {
		result.push(node)
		if (node.children) result.push(...flattenTreeNodes(node.children))
	}
	return result
}

function deepCloneNodes(nodes: TreeNode[]): TreeNode[] {
	return nodes.map((n) => ({
		...n,
		children: n.children ? deepCloneNodes(n.children) : undefined,
	}))
}

/** Relative tolerance for grand-total reconciliation in {@link rerootValidatedAbstractTotals}. */
const ABSTRACT_TOTAL_RECONCILE_TOLERANCE = 0.005

/**
 * Rightmost numeric value within a subtree — the trailing subtotal an XBRL
 * abstract grouping conventionally ends with. Returns the node's own value
 * when numeric (so a numeric subtotal that has detail children still reports
 * its own total), otherwise walks the last child recursively.
 */
function trailingSubtotalValue(node: TreeNode): number | null {
	const own = numericValue(node)
	if (own !== null) return own
	const children = node.children ?? []
	for (let i = children.length - 1; i >= 0; i--) {
		const childVal = trailingSubtotalValue(children[i]!)
		if (childVal !== null) return childVal
	}
	return null
}

/**
 * Re-root a grand-total leaf under its abstract grouping (value-validated).
 *
 * XBRL balance sheets (esp. utilities) commonly nest the asset hierarchy as
 *
 *   AssetsAbstract
 *   ├─ AssetsCurrentAbstract                → … → AssetsCurrent  (subtotal)
 *   ├─ PropertyPlantAndEquipmentNetAbstract → … → …Net          (subtotal)
 *   ├─ RegulatedEntityOtherAssetsNoncurrentAbstract → …         (subtotal)
 *   └─ Assets                                                   (grand total leaf)
 *
 * with no calculation arcs from `Assets`. When an abstract grouping has a
 * childless numeric "twin" (key === abstract minus `Abstract`) AND the trailing
 * subtotals of its other children reconcile to the twin's value, re-root those
 * other children under the twin so the grand total becomes a real parent the
 * mapper can propagate from. Bottom-up so nested groupings resolve first.
 */
function rerootValidatedAbstractTotals(node: TreeNode): TreeNode {
	const children = (node.children ?? []).map(rerootValidatedAbstractTotals)

	const norm = stripNamespace(node.key)
	if (norm.toLowerCase().endsWith('abstract') && children.length >= 2) {
		const baseNorm = norm.slice(0, norm.length - 'Abstract'.length).toLowerCase()
		const twinIdx = children.findIndex(
			(c) => stripNamespace(c.key).toLowerCase() === baseNorm && numericValue(c) !== null,
		)
		if (twinIdx !== -1) {
			const twin = children[twinIdx]!
			const total = numericValue(twin)
			const twinHasChildren = Boolean(twin.children && twin.children.length > 0)
			if (total !== null && total !== 0 && !twinHasChildren) {
				const others = children.filter((_, i) => i !== twinIdx)
				const reps = others.map(trailingSubtotalValue)
				if (reps.every((r): r is number => r !== null)) {
					const sum = reps.reduce((acc, r) => acc + r, 0)
					const tol = Math.max(1, Math.abs(total) * ABSTRACT_TOTAL_RECONCILE_TOLERANCE)
					if (Math.abs(sum - total) <= tol) {
						return { ...node, children: [{ ...twin, children: others }] }
					}
				}
			}
		}
	}

	return { ...node, children: node.children ? children : undefined }
}

/**
 * Returns true when `node` is an abstract grouping (`…Abstract`) that carries
 * no numeric value anywhere in its subtree — typically because its real
 * subtotal is a calc-native root that was pruned out of the presentation-only
 * branch (e.g. `AssetsCurrentAbstract` once `AssetsCurrent` is hoisted to a
 * calculation root).
 */
function isEmptyAbstractPlaceholder(node: TreeNode): boolean {
	return stripNamespace(node.key).toLowerCase().endsWith('abstract') && trailingSubtotalValue(node) === null
}

/**
 * Completes {@link rerootValidatedAbstractTotals}: a re-rooted grand total
 * (e.g. `Assets`) can be left parenting an *empty* abstract placeholder
 * (`AssetsCurrentAbstract`) when that section's real subtotal (`AssetsCurrent`)
 * exists only as a separate calc-native root. Replace each such placeholder
 * with the matching top-level calc root (by abstract→twin key) and remove that
 * root from the top level — but only when doing so makes the total's children
 * fully reconcile to its value, so the adoption is value-validated and safe.
 */
function adoptCalcRootsUnderRerootedTotals(roots: TreeNode[]): TreeNode[] {
	const topLevelByKey = new Map<string, { node: TreeNode; idx: number }>()
	roots.forEach((root, idx) => {
		const norm = stripNamespace(root.key).toLowerCase()
		if (!topLevelByKey.has(norm)) topLevelByKey.set(norm, { node: root, idx })
	})
	const adoptedIdx = new Set<number>()

	const visit = (node: TreeNode): TreeNode => {
		const children = (node.children ?? []).map(visit)
		const total = numericValue(node)
		if (total !== null && total !== 0 && children.length >= 1) {
			const adoptions = new Map<number, { root: TreeNode; rootIdx: number }>()
			children.forEach((child, ci) => {
				if (!isEmptyAbstractPlaceholder(child)) return
				const twin = stripNamespace(child.key).slice(0, -'Abstract'.length).toLowerCase()
				const match = topLevelByKey.get(twin)
				if (match && !adoptedIdx.has(match.idx) && numericValue(match.node) !== null) {
					adoptions.set(ci, { root: match.node, rootIdx: match.idx })
				}
			})
			if (adoptions.size > 0) {
				const reps = children.map((child, ci) => {
					const adoption = adoptions.get(ci)
					return adoption ? numericValue(adoption.root) : trailingSubtotalValue(child)
				})
				if (reps.every((r): r is number => r !== null)) {
					const sum = reps.reduce((acc, r) => acc + r, 0)
					const tol = Math.max(1, Math.abs(total) * ABSTRACT_TOTAL_RECONCILE_TOLERANCE)
					if (Math.abs(sum - total) <= tol) {
						const adoptedChildren = children.map((child, ci) => {
							const adoption = adoptions.get(ci)
							if (!adoption) return child
							adoptedIdx.add(adoption.rootIdx)
							return adoption.root
						})
						return { ...node, children: adoptedChildren }
					}
				}
			}
		}
		return { ...node, children: node.children ? children : undefined }
	}

	const visited = roots.map(visit)
	return visited.filter((_, idx) => !adoptedIdx.has(idx))
}

/**
 * Cash-flow sign weight for a presentation line being folded under a subtotal.
 * The presentation linkbase stores most cash-flow line items as positive
 * magnitudes with the economic direction carried only in the (absent)
 * calculation weight; reconstruct that sign from the concept's label tokens.
 * When both an outflow and inflow token are present, the first token wins.
 */
function inferCashFlowSignWeight(node: TreeNode): number {
	const text = stripNamespace(node.key).toLowerCase()
	const outflow = /(payment|purchase|acquire|repurchase|repay|paid|advance|originat)/.exec(text)
	const inflow = /(proceed|sale|sales|maturit|collection|disposal|sold|receipt)/.exec(text)
	if (outflow && inflow) return outflow.index <= inflow.index ? -1 : 1
	if (outflow) return -1
	return 1
}

/**
 * Resolve the hierarchy inside an appended presentation-only subtree by
 * folding abstract groupings onto their concrete subtotal twin. When an
 * abstract has a child whose normalized key equals the abstract's key without
 * the trailing `Abstract`, re-root the abstract's other children under that
 * twin. Folded children get an inferred cash-flow sign weight so leaf values
 * carry the right sign.
 */
function resolveAbstractTwinSubtotals(node: TreeNode): TreeNode {
	const children = (node.children ?? []).map(resolveAbstractTwinSubtotals)

	const norm = stripNamespace(node.key)
	if (norm.toLowerCase().endsWith('abstract')) {
		const baseNorm = norm.slice(0, norm.length - 'Abstract'.length).toLowerCase()
		const twinIdx = children.findIndex((c) => stripNamespace(c.key).toLowerCase() === baseNorm)
		if (twinIdx !== -1) {
			const twin = children[twinIdx]!
			const others = children.filter((_, i) => i !== twinIdx)
			const twinHasChildren = Boolean(twin.children && twin.children.length > 0)
			if (others.length > 0 && !twinHasChildren) {
				const nested = others.map((c) =>
					c.children && c.children.length > 0 ? c : { ...c, weight: inferCashFlowSignWeight(c) },
				)
				return { ...node, children: [{ ...twin, children: nested }] }
			}
		}
	}

	return { ...node, children: node.children ? children : undefined }
}

interface PresentationContext {
	node: TreeNode
	siblings: TreeNode[]
	index: number
}

function buildPresentationContexts(roots: TreeNode[]): Map<string, PresentationContext[]> {
	const contexts = new Map<string, PresentationContext[]>()

	function walk(nodes: TreeNode[]): void {
		nodes.forEach((node, index) => {
			const norm = stripNamespace(node.key)
			const list = contexts.get(norm) ?? []
			list.push({ node, siblings: nodes, index })
			contexts.set(norm, list)
			if (node.children) walk(node.children)
		})
	}

	walk(roots)
	return contexts
}

interface InferredCloneFlags {
	options?: MergePresentationIntoCalculationOptions
	originalCalcKeys: Set<string>
}

function cloneWithInferredPresentationChildren(
	node: TreeNode,
	contexts: Map<string, PresentationContext[]>,
	stack: Set<string>,
	inferFlags: InferredCloneFlags | undefined,
	fromInferredPresentation: boolean,
): TreeNode {
	const norm = stripNamespace(node.key)
	const children = (node.children ?? []).map((child) =>
		cloneWithInferredPresentationChildren(child, contexts, stack, inferFlags, fromInferredPresentation),
	)
	const existingChildKeys = new Set(children.map((child) => stripNamespace(child.key)))
	const childStack = new Set(stack)
	childStack.add(norm)
	const inferred = inferPresentationChildren(node, contexts, stack)
		.filter((child) => !existingChildKeys.has(stripNamespace(child.key)))
		.map((child) => cloneWithInferredPresentationChildren(child, contexts, childStack, inferFlags, true))

	let out: TreeNode = {
		...node,
		children: children.concat(inferred),
	}
	if (
		inferFlags?.options?.markEnrichedFromPresentation &&
		fromInferredPresentation &&
		!inferFlags.originalCalcKeys.has(norm)
	) {
		out = { ...out, enrichedFromPresentation: true }
	}
	return out
}

function inferPresentationChildren(
	node: TreeNode,
	contexts: Map<string, PresentationContext[]>,
	stack: Set<string>,
): TreeNode[] {
	const norm = stripNamespace(node.key)
	if (stack.has(norm)) return []

	const targetValue = numericValue(node)
	if (targetValue === null) return []

	for (const context of contexts.get(norm) ?? []) {
		// Skip duplicate presentation rows — if a prior sibling has the same
		// key, this is a summary/subtotal repeat whose preceding siblings are
		// unrelated to this node's children.
		const hasPriorDuplicate = context.siblings
			.slice(0, context.index)
			.some((s) => stripNamespace(s.key) === norm)
		if (hasPriorDuplicate) continue

		const candidates = findRollupCandidateSiblings(context, targetValue)
		if (candidates.length > 0) return candidates
	}
	return []
}

function signedPresentationLineContribution(node: TreeNode): number {
	const value = numericValue(node) ?? 0
	if (value < 0) return value

	const text = `${stripNamespace(node.key)} ${node.label ?? ''}`.toLowerCase()
	const isDeduction =
		/(expense|cost|tax|amortization|depreciation|depletion|selling|marketing|administrative|research|development|interest)/.test(
			text,
		) && !/(income|profit|revenue|sales|gain)/.test(text)

	return isDeduction ? -Math.abs(value) : value
}

function findRollupCandidateSiblings(context: PresentationContext, targetValue: number): TreeNode[] {
	const priorNumericSiblings = context.siblings
		.slice(0, context.index)
		.filter((node) => numericValue(node) !== null)

	// Pass 1: signed-label heuristic. Correct for income-statement subtotals
	// where rows labelled "expense / cost / tax / …" are deductions.
	const signed = scanTrailingRollupSlices(
		priorNumericSiblings,
		targetValue,
		signedPresentationLineContribution,
	)
	if (signed.length > 0) return signed

	// Pass 2 (fallback): strict unsigned sum. Balance-sheet groupings (e.g.
	// the current-assets block ending in `AssetsCurrent`) contain additive
	// asset lines whose labels match the deduction regex; an unsigned rollup
	// recovers these. Only runs when the signed pass found nothing.
	return scanTrailingRollupSlices(priorNumericSiblings, targetValue, (node) => numericValue(node) ?? 0)
}

function scanTrailingRollupSlices(
	priorNumericSiblings: TreeNode[],
	targetValue: number,
	contribution: (node: TreeNode) => number,
): TreeNode[] {
	for (let start = priorNumericSiblings.length - 1; start >= 0; start--) {
		const slice = priorNumericSiblings.slice(start)
		if (slice.length === 0) continue
		const sum = slice.reduce((total, node) => total + contribution(node), 0)
		if (Math.abs(sum - targetValue) <= 1) return slice
	}

	return []
}

function presentationLeafPassesNonZeroFilter(node: TreeNode, requireNonZero: boolean): boolean {
	if (!requireNonZero) return true
	const v = numericValue(node)
	if (v === null) return false
	return Math.abs(v) > PRESENTATION_LEAF_NONZERO_EPS
}

function prunePresentationOnly(
	node: TreeNode,
	calcKeys: Set<string>,
	opts: MergePresentationIntoCalculationOptions | undefined,
	originalCalcKeys: Set<string>,
): TreeNode | null {
	const rz = opts?.requireNonZeroPresentationLeaves === true
	const mark = opts?.markEnrichedFromPresentation === true
	const children = (node.children ?? [])
		.map((child) => prunePresentationOnly(child, calcKeys, opts, originalCalcKeys))
		.filter((child): child is TreeNode => child !== null)
	const norm = stripNamespace(node.key)
	const existsInCalculation = calcKeys.has(norm)

	if (existsInCalculation && children.length === 0) return null
	if (children.length === 0) {
		if (rz && !presentationLeafPassesNonZeroFilter(node, true)) return null
		let leaf: TreeNode = { ...node, children: undefined }
		if (mark && !originalCalcKeys.has(norm)) {
			leaf = { ...leaf, enrichedFromPresentation: true }
		}
		return leaf
	}
	let withChildren: TreeNode = { ...node, children }
	if (mark && !originalCalcKeys.has(norm)) {
		withChildren = { ...withChildren, enrichedFromPresentation: true }
	}
	return withChildren
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

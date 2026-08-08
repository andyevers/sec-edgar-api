/**
 * The member nesting a report's presentation linkbase states outright.
 *
 * A dimensional breakdown arrives on a `TreeNode` as a flat `MemberFact[]`, and recovering how
 * those members nest is otherwise a search over their values. But the filer usually wrote the
 * structure down: under a report's presentation link, an `…Axis` locator has its domain beneath
 * it and the domain's members beneath that — and members are frequently nested under other
 * members, which is exactly the parent/child relation the flat fact list lost.
 *
 *     srt:ProductOrServiceAxis
 *       srt:ProductsAndServicesDomain
 *         goog:GoogleAdvertisingRevenueMember
 *           goog:GoogleSearchOtherMember
 *           goog:YouTubeAdvertisingRevenueMember
 *
 * Two cautions shape what this emits, and neither is a reason to skip it:
 *
 *  1. **The presentation linkbase is display order, not arithmetic.** A parent here is what the
 *     filer indented, not something the numbers were checked against. So this is published as
 *     *declared* structure for a consumer to sum-validate; nothing downstream should treat an
 *     edge as proven just because it appears here.
 *  2. **Domain nodes are not members.** A domain is the axis default — the "all" case, carrying
 *     the undimensioned total rather than a slice of it. Its children are lifted into its place
 *     so the emitted roots are the members a fact can actually be tagged with.
 */
import { XbrlLinkbaseItemExtended } from '../types'

/** A member as the presentation linkbase nests it. Children are *declared*, not sum-checked. */
export interface DomainMemberNode {
	key: string
	label: string
	children?: DomainMemberNode[]
}

/** One axis's declared member nesting within a single report. */
export interface MemberDomainAxis {
	axis: string
	axisLabel: string
	roots: DomainMemberNode[]
}

const AXIS_SUFFIX = /Axis$/
const DOMAIN_SUFFIX = /Domain$/

/**
 * Every axis in a report's presentation links, with its members nested as declared.
 *
 * Axes whose members are entirely flat are still emitted — the axis grouping alone tells a
 * consumer which members belong to the same decomposition, which is worth having even when no
 * parent/child edge came with it.
 */
export function buildMemberDomains(params: {
	presentationLinksReport: XbrlLinkbaseItemExtended[]
	labelByKey?: Map<string, string>
	hrefToKey: (href: string) => string
}): MemberDomainAxis[] {
	const { presentationLinksReport, labelByKey, hrefToKey } = params

	const childrenByKey = new Map<string, { key: string; order: number }[]>()
	const axes: string[] = []
	const seenAxis = new Set<string>()

	const noteAxis = (key: string) => {
		if (!AXIS_SUFFIX.test(key) || seenAxis.has(key)) return
		seenAxis.add(key)
		axes.push(key)
	}

	for (const link of presentationLinksReport) {
		const locatorByLabel = new Map((link.loc ?? []).map((l) => [l.label, l]))
		for (const arc of link.presentationArc ?? []) {
			const from = hrefToKey(locatorByLabel.get(arc.from)?.href ?? '')
			const to = hrefToKey(locatorByLabel.get(arc.to)?.href ?? '')
			if (!from || !to) continue
			const bucket = childrenByKey.get(from) ?? []
			// The same arc can be declared in more than one presentation link for a role.
			if (bucket.some((entry) => entry.key === to)) continue
			bucket.push({ key: to, order: Number(arc.order ?? bucket.length) })
			childrenByKey.set(from, bucket)
			noteAxis(from)
			noteAxis(to)
		}
	}

	const labelFor = (key: string) => labelByKey?.get(key) ?? key

	const out: MemberDomainAxis[] = []
	for (const axis of axes) {
		const roots = membersUnder(axis, childrenByKey, labelFor, [axis])
		if (roots.length === 0) continue
		out.push({ axis, axisLabel: labelFor(axis), roots })
	}
	return out
}

/**
 * The members below `key`, with domain levels collapsed away.
 *
 * `visited` is the current branch rather than everything seen: a member may legitimately appear
 * under two different parents in the same report, and a shared set would silently truncate the
 * second occurrence. Cycles are still impossible because a branch never revisits its ancestors.
 */
function membersUnder(
	key: string,
	childrenByKey: ReadonlyMap<string, { key: string; order: number }[]>,
	labelFor: (key: string) => string,
	visited: readonly string[],
): DomainMemberNode[] {
	const children = (childrenByKey.get(key) ?? []).slice().sort((a, b) => a.order - b.order)
	const out: DomainMemberNode[] = []

	for (const child of children) {
		if (visited.indexOf(child.key) >= 0) continue
		// A nested axis under an axis is a separate decomposition, not a member of this one.
		if (AXIS_SUFFIX.test(child.key)) continue
		const nested = membersUnder(child.key, childrenByKey, labelFor, visited.concat(child.key))
		if (DOMAIN_SUFFIX.test(child.key)) {
			out.push(...nested)
			continue
		}
		out.push({
			key: child.key,
			label: labelFor(child.key),
			...(nested.length > 0 ? { children: nested } : {}),
		})
	}

	return out
}

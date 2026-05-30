export interface RollupMemberFact {
	segments: { dimension: string; value: string; label?: string }[]
	value: string | number | null
}

const AXIS_SIG_SEP = '>'

/**
 * Ordered dimension (axis) signature for a member row. Encodes both the axes
 * and the segment count, so a 2-segment row and a 3-segment row always produce
 * different signatures (and therefore land in different axis groups).
 */
export function axisSignature(member: RollupMemberFact): string | null {
	const segs = member.segments
	if (!segs || segs.length === 0) return null
	return segs.map((s) => s.dimension).join(AXIS_SIG_SEP)
}

/**
 * True when every member row has the same non-empty list of dimension **types**
 * (axis URIs) in the same order. Member **values** along those axes may differ
 * (e.g. two segment breakdown rows that both use Consolidation + Operating +
 * Business segment axes).
 */
export function allMembersShareHomogeneousDimensions(members: RollupMemberFact[]): boolean {
	if (members.length === 0) return false
	const ref = members[0]!.segments
	if (!ref || ref.length === 0) return false
	const dimSig = ref.map((s) => s.dimension).join(AXIS_SIG_SEP)
	for (const m of members) {
		const segs = m.segments
		if (!segs || segs.length !== ref.length) return false
		if (segs.map((s) => s.dimension).join(AXIS_SIG_SEP) !== dimSig) return false
	}
	return true
}

/**
 * Roll a node value up from its members when the members corroborate a single
 * total across one or more axes.
 *
 * Members are grouped by their {@link axisSignature} (ordered dimension list,
 * which also distinguishes 2-segment rows from 3-segment rows so a child
 * breakdown never gets summed together with its parent breakdown). Each group
 * whose values are all finite numeric is summed.
 *
 * - One valid group  → its sum (the single-axis case).
 * - Multiple valid groups that all sum to the **same** value → that value
 *   (independent breakdowns of the same total agree).
 * - Valid groups disagree, or no group is numeric → `null` (no rollup).
 */
export function sumMembersByAxisAgreement(members: RollupMemberFact[]): number | null {
	if (members.length === 0) return null

	const groups = new Map<string, RollupMemberFact[]>()
	for (const m of members) {
		const sig = axisSignature(m)
		if (sig === null) return null
		const bucket = groups.get(sig) ?? groups.set(sig, []).get(sig)!
		bucket.push(m)
	}

	const groupSums: number[] = []
	for (const group of Array.from(groups.values())) {
		const sum = sumMemberNumericValues(group)
		if (sum === null) continue
		groupSums.push(sum)
	}

	if (groupSums.length === 0) return null

	const first = groupSums[0]!
	return groupSums.every((s) => s === first) ? first : null
}

/** @deprecated Use {@link allMembersShareHomogeneousDimensions} — kept for callers that only need the 1-segment case. */
export function allMembersShareSingleAxis(members: RollupMemberFact[]): boolean {
	return (
		members.length > 0 &&
		members.every((m) => m.segments?.length === 1) &&
		allMembersShareHomogeneousDimensions(members)
	)
}

/**
 * Sum of member `value`s when every value is finite numeric; otherwise null.
 */
export function sumMemberNumericValues(members: RollupMemberFact[]): number | null {
	let sum = 0
	for (const m of members) {
		const v = m.value
		if (v === null || v === undefined) return null
		const n = typeof v === 'number' ? v : Number(v)
		if (!Number.isFinite(n)) return null
		sum += n
	}
	return sum
}

export function primaryFactHasFiniteNumericValue(primary: { value: number | string } | null): boolean {
	if (primary == null) return false
	const v = primary.value
	if (typeof v === 'number') return Number.isFinite(v)
	if (typeof v === 'string') {
		if (v.trim() === '') return false
		return Number.isFinite(Number(v))
	}
	return false
}

/**
 * When rollup is enabled: if there is no usable primary (non-dimensional) numeric
 * fact, return the sum implied by the members when they agree on a single total —
 * either a single axis group, or multiple axis groups that each sum to the same
 * value (see {@link sumMembersByAxisAgreement}).
 * Otherwise return the primary fact value (including non-numeric) or null.
 */
export function resolveConceptTreeValue(params: {
	primary: { value: number | string } | null
	members: RollupMemberFact[]
	rollupParentValueFromSingleAxisMembers: boolean
}): number | string | null {
	const { primary, members, rollupParentValueFromSingleAxisMembers } = params

	if (primaryFactHasFiniteNumericValue(primary)) {
		return primary!.value
	}

	if (rollupParentValueFromSingleAxisMembers && members.length > 0) {
		const sum = sumMembersByAxisAgreement(members)
		if (sum !== null) return sum
	}

	if (primary == null) return null
	return primary.value ?? null
}

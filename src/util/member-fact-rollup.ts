export interface RollupMemberFact {
	segments: { dimension: string; value: string; label?: string }[]
	value: string | number | null
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
	const dimSig = ref.map((s) => s.dimension).join('\u001e')
	for (const m of members) {
		const segs = m.segments
		if (!segs || segs.length !== ref.length) return false
		if (segs.map((s) => s.dimension).join('\u001e') !== dimSig) return false
	}
	return true
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
 * fact but all members share the same dimensional axis stack, return the sum of
 * member values.
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

	if (
		rollupParentValueFromSingleAxisMembers &&
		members.length > 0 &&
		allMembersShareHomogeneousDimensions(members)
	) {
		const sum = sumMemberNumericValues(members)
		if (sum !== null) return sum
	}

	if (primary == null) return null
	return primary.value ?? null
}

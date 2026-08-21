import {
	allMembersShareHomogeneousDimensions,
	allMembersShareSingleAxis,
	isRegistrantScoped,
	resolveConceptTreeValue,
	resolveConceptTreeValueWithProvenance,
	sumMemberNumericValues,
	sumMembersByAxisAgreement,
	sumRegistrantScopedMembers,
} from '../src/util/member-fact-rollup'

describe('member-fact-rollup', () => {
	test('allMembersShareHomogeneousDimensions allows multi-axis rows with same axis stack', () => {
		const segA = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'y', label: '' },
			{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:Company', label: '' },
		]
		const segB = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'y', label: '' },
			{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:FordCredit', label: '' },
		]
		expect(
			allMembersShareHomogeneousDimensions([
				{ segments: segA, value: 727 },
				{ segments: segB, value: 49063 },
			]),
		).toBe(true)
		expect(
			allMembersShareHomogeneousDimensions([
				{ segments: segA, value: 1 },
				{
					segments: [
						{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
						{ dimension: 'us-gaap:OtherAxis', value: 'y', label: '' },
					],
					value: 2,
				},
			]),
		).toBe(false)
	})

	test('allMembersShareSingleAxis requires one segment and same dimension', () => {
		expect(
			allMembersShareSingleAxis([
				{ segments: [{ dimension: 'us-gaap:FooAxis', value: 'a', label: '' }], value: 1 },
				{ segments: [{ dimension: 'us-gaap:FooAxis', value: 'b', label: '' }], value: 2 },
			]),
		).toBe(true)
		expect(
			allMembersShareSingleAxis([
				{ segments: [{ dimension: 'us-gaap:FooAxis', value: 'a', label: '' }], value: 1 },
				{ segments: [{ dimension: 'us-gaap:BarAxis', value: 'b', label: '' }], value: 2 },
			]),
		).toBe(false)
		expect(
			allMembersShareSingleAxis([
				{
					segments: [
						{ dimension: 'a', value: '1', label: '' },
						{ dimension: 'b', value: '2', label: '' },
					],
					value: 1,
				},
			]),
		).toBe(false)
	})

	test('sumMemberNumericValues sums finite numbers', () => {
		expect(
			sumMemberNumericValues([
				{ segments: [{ dimension: 'x', value: 'm1', label: '' }], value: 727 },
				{ segments: [{ dimension: 'x', value: 'm2', label: '' }], value: 49063 },
			]),
		).toBe(49790)
	})

	test('resolveConceptTreeValue prefers primary numeric fact', () => {
		expect(
			resolveConceptTreeValue({
				primary: { value: 100 },
				members: [{ segments: [{ dimension: 'x', value: 'a', label: '' }], value: 50 }],
				rollupParentValueFromSingleAxisMembers: true,
			}),
		).toBe(100)
	})

	test('resolveConceptTreeValue rolls up single-axis members when no primary', () => {
		expect(
			resolveConceptTreeValue({
				primary: null,
				members: [
					{
						segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:A', label: '' }],
						value: 727,
					},
					{
						segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:B', label: '' }],
						value: 49063,
					},
				],
				rollupParentValueFromSingleAxisMembers: true,
			}),
		).toBe(49790)
	})

	test('resolveConceptTreeValue rolls up multi-axis homogeneous members when no primary', () => {
		const segA = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'y', label: '' },
			{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:A', label: '' },
		]
		const segB = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'y', label: '' },
			{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:B', label: '' },
		]
		expect(
			resolveConceptTreeValue({
				primary: null,
				members: [
					{ segments: segA, value: 727 },
					{ segments: segB, value: 49063 },
				],
				rollupParentValueFromSingleAxisMembers: true,
			}),
		).toBe(49790)
	})

	test('resolveConceptTreeValue skips rollup when disabled', () => {
		expect(
			resolveConceptTreeValue({
				primary: null,
				members: [
					{ segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:A', label: '' }], value: 1 },
					{ segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:B', label: '' }], value: 2 },
				],
				rollupParentValueFromSingleAxisMembers: false,
			}),
		).toBe(null)
	})

	test('resolveConceptTreeValue rolls up when two single-axis groups agree on the same total', () => {
		expect(
			resolveConceptTreeValue({
				primary: null,
				members: [
					// Breakdown by class of stock.
					{ segments: [{ dimension: 'us-gaap:StatementClassOfStockAxis', value: 's:ClassA', label: '' }], value: 600 },
					{ segments: [{ dimension: 'us-gaap:StatementClassOfStockAxis', value: 's:ClassB', label: '' }], value: 400 },
					// Independent breakdown by equity component, same 1,000 total.
					{
						segments: [{ dimension: 'us-gaap:StatementEquityComponentsAxis', value: 'us-gaap:CommonStockMember', label: '' }],
						value: 1000,
					},
				],
				rollupParentValueFromSingleAxisMembers: true,
			}),
		).toBe(1000)
	})

	test('resolveConceptTreeValue does not roll up when axis groups disagree', () => {
		expect(
			resolveConceptTreeValue({
				primary: null,
				members: [
					{ segments: [{ dimension: 'us-gaap:StatementClassOfStockAxis', value: 's:ClassA', label: '' }], value: 600 },
					{ segments: [{ dimension: 'us-gaap:StatementClassOfStockAxis', value: 's:ClassB', label: '' }], value: 400 },
					{
						segments: [{ dimension: 'us-gaap:StatementEquityComponentsAxis', value: 'us-gaap:CommonStockMember', label: '' }],
						value: 999,
					},
				],
				rollupParentValueFromSingleAxisMembers: true,
			}),
		).toBe(null)
	})

	test('resolveConceptTreeValue rolls up when a 3-segment child breakdown sums to the 2-segment total', () => {
		const twoSegA = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'segA', label: '' },
		]
		const twoSegB = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'segB', label: '' },
		]
		const threeSeg = (product: string, value: number) => ({
			segments: [
				{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
				{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'segA', label: '' },
				{ dimension: 'srt:ProductOrServiceAxis', value: product, label: '' },
			],
			value,
		})
		expect(
			resolveConceptTreeValue({
				primary: null,
				members: [
					// 2-segment group sums to 100.
					{ segments: twoSegA, value: 70 },
					{ segments: twoSegB, value: 30 },
					// 3-segment child breakdown of the same data also sums to 100.
					threeSeg('p1', 40),
					threeSeg('p2', 60),
				],
				rollupParentValueFromSingleAxisMembers: true,
			}),
		).toBe(100)
	})

	test('resolveConceptTreeValue does not roll up when the 3-segment breakdown is partial', () => {
		const twoSegA = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'segA', label: '' },
		]
		const twoSegB = [
			{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
			{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'segB', label: '' },
		]
		const threeSeg = (product: string, value: number) => ({
			segments: [
				{ dimension: 'srt:ConsolidationItemsAxis', value: 'x', label: '' },
				{ dimension: 'us-gaap:OperatingSegmentsAxis', value: 'segA', label: '' },
				{ dimension: 'srt:ProductOrServiceAxis', value: product, label: '' },
			],
			value,
		})
		expect(
			resolveConceptTreeValue({
				primary: null,
				members: [
					{ segments: twoSegA, value: 70 },
					{ segments: twoSegB, value: 30 },
					// Only part of the 3-segment breakdown is present → sums to 40, not 100.
					threeSeg('p1', 40),
				],
				rollupParentValueFromSingleAxisMembers: true,
			}),
		).toBe(null)
	})

	describe('registrant-scoped members', () => {
		const LEA = 'dei:LegalEntityAxis'
		const vepco = {
			segments: [{ dimension: LEA, value: 'd:VirginiaElectricAndPowerCompanyMember', label: '' }],
			value: 2669000000,
		}

		test('isRegistrantScoped flags dei:LegalEntityAxis rows only', () => {
			expect(isRegistrantScoped(vepco)).toBe(true)
			expect(
				isRegistrantScoped({
					segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:Auto', label: '' }],
					value: 1,
				}),
			).toBe(false)
			expect(isRegistrantScoped({ segments: [], value: 1 })).toBe(false)
		})

		test('a co-registrant member never becomes the parent row value', () => {
			// D 2025 Q1: us-gaap:PaymentsToAcquirePropertyPlantAndEquipment is tagged
			// only for Virginia Power. Rolling it up put VEPCO's 2.669B on Dominion's
			// consolidated capex line, which Yahoo reports as 3.213B.
			expect(sumMembersByAxisAgreement([vepco])).toBeNull()
			expect(
				resolveConceptTreeValue({
					primary: null,
					members: [vepco],
					rollupParentValueFromSingleAxisMembers: true,
				}),
			).toBeNull()
		})

		test('registrant scoping does not disable ordinary breakdown rollups', () => {
			const segment = (value: string, n: number) => ({
				segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value, label: '' }],
				value: n,
			})
			expect(sumMembersByAxisAgreement([segment('f:Auto', 40), segment('f:Credit', 60)])).toBe(100)
		})

		test('a mixed group sums only the component members', () => {
			const segment = {
				segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value: 'f:Auto', label: '' }],
				value: 40,
			}
			expect(sumMembersByAxisAgreement([vepco, segment])).toBe(40)
		})
	})

	describe('registrant-scoped fallback with provenance', () => {
		const LEA = 'dei:LegalEntityAxis'
		const vepco = {
			segments: [{ dimension: LEA, value: 'd:VirginiaElectricAndPowerCompanyMember', label: '' }],
			value: 2669000000,
		}
		const vepcoRelatedParty = {
			segments: [
				{ dimension: 'us-gaap:RelatedPartyTransactionAxis', value: 'd:ServicesProvidedByAffiliatesMember', label: '' },
				{ dimension: LEA, value: 'd:VirginiaElectricAndPowerCompanyMember', label: '' },
			],
			value: 75000000,
		}

		test('sumRegistrantScopedMembers sums a lone registrant slice', () => {
			expect(sumRegistrantScopedMembers([vepco])).toBe(2669000000)
		})

		test('sumRegistrantScopedMembers keeps axis-group agreement (disagreeing breakdown vetoes)', () => {
			// D's related-party parenthetical: the registrant slice and the
			// registrant's own deeper breakdown disagree — no fallback value,
			// matching the strict rollup's own veto semantics.
			expect(sumRegistrantScopedMembers([vepco, vepcoRelatedParty])).toBeNull()
		})

		test('provenance resolver flags the registrant fallback, not the strict rollup', () => {
			const segment = (value: string, n: number) => ({
				segments: [{ dimension: 'us-gaap:StatementBusinessSegmentsAxis', value, label: '' }],
				value: n,
			})
			const strict = resolveConceptTreeValueWithProvenance({
				primary: null,
				members: [segment('f:Auto', 40), segment('f:Credit', 60)],
				rollupParentValueFromSingleAxisMembers: true,
			})
			expect(strict).toEqual({ value: 100, registrantScopedRollup: false })

			const scoped = resolveConceptTreeValueWithProvenance({
				primary: null,
				members: [vepco],
				rollupParentValueFromSingleAxisMembers: true,
			})
			expect(scoped).toEqual({ value: 2669000000, registrantScopedRollup: true })
		})

		test('global fallback fires only when the report admitted no members', () => {
			// PCG shape: the consolidated report's presentation never admits the
			// Utility member, so members is empty — the concept's global facts
			// supply the value, flagged for corroboration.
			const utility = {
				segments: [{ dimension: LEA, value: 'pcg:PacificGasAndElectricCompanyMember', label: '' }],
				value: 3000000,
			}
			expect(
				resolveConceptTreeValueWithProvenance({
					primary: null,
					members: [],
					allMembers: [utility],
					rollupParentValueFromSingleAxisMembers: true,
				}),
			).toEqual({ value: 3000000, registrantScopedRollup: true })
			// A genuine primary always wins, unflagged.
			expect(
				resolveConceptTreeValueWithProvenance({
					primary: { value: 5 },
					members: [],
					allMembers: [utility],
					rollupParentValueFromSingleAxisMembers: true,
				}),
			).toEqual({ value: 5, registrantScopedRollup: false })
		})
	})
})

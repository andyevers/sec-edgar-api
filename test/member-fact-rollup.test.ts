import {
	allMembersShareHomogeneousDimensions,
	allMembersShareSingleAxis,
	resolveConceptTreeValue,
	sumMemberNumericValues,
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
})

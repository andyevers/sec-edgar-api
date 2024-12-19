import { CompanyFactListData, FactGroup, FactItem, FactValue, SplitData } from '../../types'
import { KEY_SPLIT } from '../../util/constants'
import FactPeriodResolver from './FactPeriodResolver'

/**
 * Splits can be filed multiple times throughout different reports. There is no clear
 * indication on when the split is executed or what facts the split has been applied to. This
 * class tries to determine which splits have been applied and which need to be adjusted for
 * each fact.
 */
export default class FactSplitAdjuster {
	private readonly keySplit = KEY_SPLIT

	private preferFirstValue = true

	private getGroupValue(factGroup: FactGroup, isTrailing: boolean) {
		if (isTrailing) {
			return Number(this.preferFirstValue ? factGroup.valueTrailingFirst : factGroup.valueTrailingLast)
		} else {
			return Number(this.preferFirstValue ? factGroup.valuePeriodFirst : factGroup.valuePeriodLast)
		}
	}

	public getSplits(params: { splitFacts: FactValue[] | FactItem[] }) {
		const splitFacts = [...params.splitFacts].sort((a, b) => (a.end < b.end ? -1 : 1))
		const YEAR_MS = 31_536_000_000

		const splits: SplitData[] = []
		let currentSplit: SplitData | null = null

		for (let i = 0; i < splitFacts.length; i++) {
			const prevFact = splitFacts[i - 1]
			const fact = splitFacts[i]

			const factValue = Number((fact as FactItem).value ?? (fact as FactValue).val)
			const factValuePrev = Number((prevFact as FactItem)?.value ?? (prevFact as FactValue)?.val)
			const isSameSplitLaterFiling =
				factValue === factValuePrev && new Date(fact.end).getTime() - new Date(prevFact.end).getTime() < YEAR_MS

			if (!isSameSplitLaterFiling && currentSplit) {
				splits.push(currentSplit)
				currentSplit = null
			}

			if (!currentSplit) {
				currentSplit = {
					endFirst: fact.end,
					endLast: fact.end,
					filedFirst: fact.filed,
					filedLast: fact.filed,
					splitRatio: factValue,
				}
			} else {
				currentSplit.endFirst = fact.end < currentSplit.endFirst ? fact.end : currentSplit.endFirst
				currentSplit.endLast = fact.end > currentSplit.endLast ? fact.end : currentSplit.endLast
				currentSplit.filedFirst = fact.filed < currentSplit.filedFirst ? fact.filed : currentSplit.filedFirst
				currentSplit.filedLast = fact.filed > currentSplit.filedLast ? fact.filed : currentSplit.filedLast
			}
		}

		if (currentSplit) {
			splits.push(currentSplit)
		}

		return splits
	}

	public filterSplitFacts(params: { facts: FactItem[] }) {
		const { facts } = params
		return facts.filter((f) => f.name.endsWith(this.keySplit))
	}

	public extractSplitsFromCompanyFacts(params: { companyFactList: Pick<CompanyFactListData, 'facts'> }) {
		const { companyFactList } = params
		const factsByName = companyFactList.facts['us-gaap'] ?? {}
		return factsByName[this.keySplit]?.units.pure ?? []
	}

	public getSplitsFromCompanyFacts(params: { companyFactList: Pick<CompanyFactListData, 'facts'> }) {
		const { companyFactList } = params

		const factsByName = companyFactList.facts['us-gaap'] ?? {}
		const splitFacts = [...(factsByName[this.keySplit]?.units.pure ?? [])].sort((a, b) => (a.end < b.end ? -1 : 1))

		const YEAR_MS = 31_536_000_000

		const splits: SplitData[] = []
		let currentSplit: SplitData | null = null

		for (let i = 0; i < splitFacts.length; i++) {
			const prevFact = splitFacts[i - 1]
			const fact = splitFacts[i]

			// Assume the split is executed within the first year of the first filing...
			// sometimes a company will file the split fact mentioning that they plan on executing it later in the fiscal year
			// (ex: when Google did their 20:1 split in July of 2020)
			const isSameSplitLaterFiling =
				fact.val === prevFact?.val && new Date(fact.end).getTime() - new Date(prevFact.end).getTime() < YEAR_MS

			if (!isSameSplitLaterFiling && currentSplit) {
				splits.push(currentSplit)
				currentSplit = null
			}

			if (!currentSplit) {
				currentSplit = {
					endFirst: fact.end,
					endLast: fact.end,
					filedFirst: fact.filed,
					filedLast: fact.filed,
					splitRatio: Number(fact.val),
				}
			} else {
				currentSplit.endFirst = fact.end < currentSplit.endFirst ? fact.end : currentSplit.endFirst
				currentSplit.endLast = fact.end > currentSplit.endLast ? fact.end : currentSplit.endLast
				currentSplit.filedFirst = fact.filed < currentSplit.filedFirst ? fact.filed : currentSplit.filedFirst
				currentSplit.filedLast = fact.filed > currentSplit.filedLast ? fact.filed : currentSplit.filedLast
			}
		}

		if (currentSplit) {
			splits.push(currentSplit)
		}

		return splits
	}

	/**
	 * Returns true if the fact value was adjusted, false if it was not,
	 * and null if the comparison does not match the split
	 */
	private isAdjustedFromComparedFact(params: {
		factValue: number
		factCompare: FactItem | null
		isShareRatio: boolean
		splitVal: number
	}) {
		const { factCompare, factValue, isShareRatio, splitVal } = params

		const minValue = Math.min(factValue, Number(factCompare?.value ?? factValue))
		const maxValue = Math.max(factValue, Number(factCompare?.value ?? factValue))

		const possiblePreSplitValue = isShareRatio ? maxValue : minValue
		const possiblePostSplitValue = isShareRatio ? minValue : maxValue

		const expectedPostSplitValue = isShareRatio
			? possiblePreSplitValue / splitVal
			: possiblePreSplitValue * splitVal

		const nearnessThreshold = 0.01

		const isSplitAdjustment = Math.abs(expectedPostSplitValue - possiblePostSplitValue) < nearnessThreshold

		return isSplitAdjustment ? possiblePostSplitValue === factValue : null
	}

	/**
	 * Splits can be filed multiple times throughout different reports.
	 */
	public didApplySplit(params: {
		isShareRatio: boolean
		split: SplitData
		factGroup: FactGroup
		isTrailing: boolean
		useOppositePeriodFallback?: boolean
	}): boolean {
		const { isShareRatio, factGroup, split, isTrailing, useOppositePeriodFallback = true } = params
		const splitVal = split.splitRatio

		// string values are not adjusted
		if (typeof (factGroup.valuePeriodFirst ?? factGroup.valueTrailingFirst) === 'string') {
			return true
		}

		// can't apply split values of 0 or null
		if (!splitVal) {
			return true
		}

		// these two criteria will take care of the majority of cases where the fact was not filed in
		// the window of the first and last filing of the split
		if (factGroup.filedFirst > split.filedLast) {
			return true
		}
		if (factGroup.filedLast < split.filedFirst) {
			return false
		}

		// fact that is being used as the group value
		const resolvedFact = factGroup.facts.find((f) =>
			isTrailing ? f.value === factGroup.valueTrailingFirst : f.value === factGroup.valuePeriodFirst,
		)

		// if resolved fact not found, try checking trailing or period (whichever is not the current one)
		if (!resolvedFact && useOppositePeriodFallback) {
			return this.didApplySplit({ ...params, isTrailing: !isTrailing, useOppositePeriodFallback: false })
		}

		const refiledFacts = factGroup.facts.filter((f) => {
			const period = FactPeriodResolver.getPeriod(f)
			const isSamePeriod = isTrailing ? period === 0 || period > 3 : period <= 3
			return f !== resolvedFact && isSamePeriod
		})

		// check if one of the filed facts is the split adjustment
		for (const fact of refiledFacts) {
			const isAdjusted = this.isAdjustedFromComparedFact({
				factCompare: fact,
				factValue: Number(resolvedFact?.value),
				isShareRatio,
				splitVal,
			})

			if (isAdjusted !== null) {
				return isAdjusted
			}
		}

		if (resolvedFact?.filed && resolvedFact.filed > split.filedLast) {
			return true
		}

		if (resolvedFact?.filed && resolvedFact.filed < split.filedFirst) {
			return false
		}

		// // if the filed date of the fact overlaps with the filed date of the split, try comparing the end dates
		if (factGroup.endLast < split.endFirst && factGroup.values.length === 1) {
			return false
		}

		// if we still don't know, see if the split value puts us closer to the last known value or further
		if (typeof factGroup.valuePeriodLast === 'number') {
			const val = this.getGroupValue(factGroup, isTrailing)
			const valueWithSplit = isShareRatio ? val / splitVal : val * splitVal
			return Math.abs(factGroup.valuePeriodLast - val) < Math.abs(factGroup.valuePeriodLast - valueWithSplit)
		}

		if (typeof factGroup.valueTrailingLast === 'number') {
			const val = this.getGroupValue(factGroup, isTrailing)
			const valueWithSplit = isShareRatio ? val / splitVal : val * splitVal
			return Math.abs(factGroup.valueTrailingLast - val) < Math.abs(factGroup.valueTrailingLast - valueWithSplit)
		}

		return true
	}

	public adjustForSplits(params: { factGroups: FactGroup[]; splits: SplitData[] }) {
		const { factGroups, splits } = params

		for (const factGroup of factGroups) {
			const unitLower = factGroup.unit.toLowerCase()
			if (!unitLower.includes('share')) continue

			const isShareRatio = unitLower !== 'shares'

			for (const split of splits) {
				const factValuePeriod = this.getGroupValue(factGroup, false)
				const factValueTrailing = this.getGroupValue(factGroup, true)
				const splitValue = split.splitRatio

				if (!splitValue) continue

				// ratios (like EPS) get divided by splits, share counts get multiplied (like shares outstanding).
				if (!this.didApplySplit({ factGroup, split, isShareRatio, isTrailing: false })) {
					factGroup.valueSplitAdjustedPeriod = isShareRatio
						? factValuePeriod / splitValue
						: factValuePeriod * splitValue
				}

				if (!this.didApplySplit({ factGroup, split, isShareRatio, isTrailing: true })) {
					factGroup.valueSplitAdjustedTrailing = isShareRatio
						? factValueTrailing / splitValue
						: factValueTrailing * splitValue
				}
			}
		}
	}
}

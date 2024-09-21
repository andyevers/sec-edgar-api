import { CompanyFactListData, FactGroup, FactItem, FactValue, SplitData } from '../../types'

export default class FactSplitAdjuster {
	private readonly keySplit = 'StockholdersEquityNoteStockSplitConversionRatio1'

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

	public didApplySplit(params: { isShareRatio: boolean; split: SplitData; factGroup: FactGroup }) {
		const { isShareRatio, factGroup, split } = params
		const splitVal = split.splitRatio
		if (!splitVal) return true

		if (factGroup.filedFirst > split.filedLast) {
			return true
		}
		if (factGroup.filedLast < split.filedFirst) {
			return false
		}

		if (factGroup.valuePeriodLast !== null) {
			const val = factGroup.valuePeriodResolved ?? 0
			const valueWithSplit = isShareRatio ? val / splitVal : val * splitVal
			return Math.abs(factGroup.valuePeriodLast - val) < Math.abs(factGroup.valuePeriodLast - valueWithSplit)
		}

		if (factGroup.valueTrailingLast !== null) {
			const val = factGroup.valueTrailingResolved ?? 0
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
				if (this.didApplySplit({ factGroup, split, isShareRatio })) continue
				const factValuePeriod = factGroup.valueSplitAdjustedPeriod ?? factGroup.valuePeriodResolved ?? 0
				const factValueTrailing = factGroup.valueSplitAdjustedTrailing ?? factGroup.valueTrailingResolved ?? 0
				const splitValue = split.splitRatio

				if (!splitValue) continue

				factGroup.valueSplitAdjustedPeriod = isShareRatio
					? factValuePeriod / splitValue
					: factValuePeriod * splitValue

				factGroup.valueSplitAdjustedTrailing = isShareRatio
					? factValueTrailing / splitValue
					: factValueTrailing * splitValue
			}
		}
	}
}

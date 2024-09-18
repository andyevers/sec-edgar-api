import { FiscalPeriod } from '../../types/report-raw.type'
import { FactItemWithFiscals } from './ReportBuilder'

interface SplitData {
	end: string
	filed: string
	value: number
	firstFiled: string
	fiscalYear: number
	fiscalPeriod: FiscalPeriod
}

type FactItemWithFiscalsNumeric = Omit<FactItemWithFiscals, 'cik' | 'value'> & { value: number }

/**
 * Adjust share-based property values for splits. Checks where the split was applied,
 * and adjusts all previously filed share facts accordingly.
 */
export default class FactSplitAdjuster {
	private readonly splitKey = 'StockholdersEquityNoteStockSplitConversionRatio1'
	private readonly splitByFiscalYearAmount = new Map<string, SplitData>()

	private readonly factsByYearQuarterByPropertyName = new Map<string, Map<string, FactItemWithFiscalsNumeric>>()
	private readonly factsAnnaulByYearByPropertyName = new Map<string, Map<string, FactItemWithFiscalsNumeric>>()

	private readonly resolvedProperties = new Set<string>()

	private sortedSplits: SplitData[] | null = null

	private getMap(map: Map<string, Map<string, FactItemWithFiscalsNumeric>>, propertyName: string) {
		return map.get(propertyName) ?? map.set(propertyName, new Map()).get(propertyName)!
	}
	private filedFirstLastBySplitKey = new Map<string, { firstFiled: string; lastFiled: string }>()

	public add(fact: FactItemWithFiscalsNumeric & { filedLast?: string }) {
		const { name: propertyName, year, fiscalPeriod, unit, filed, value, end } = fact

		if (this.isSplitProperty(propertyName)) {
			this.addSplitData({ end, filed, fiscalYear: year, value: Number(value), fiscalPeriod })
			return
		}

		if (!this.isSplitAdjustableUnit(unit)) return

		if (this.resolvedProperties.has(propertyName)) {
			throw new Error(`Property ${propertyName} has already been resolved`)
		}

		const isAnnual = fiscalPeriod === 'FY'
		const map = isAnnual
			? this.getMap(this.factsAnnaulByYearByPropertyName, propertyName)
			: this.getMap(this.factsByYearQuarterByPropertyName, propertyName)

		const key = `${year}_${fiscalPeriod}`

		this.filedFirstLastBySplitKey.set(key, {
			firstFiled: filed,
			lastFiled: fact.filedLast ?? filed,
		})

		map.set(key, fact)
	}

	public getSplitsAsc() {
		if (this.sortedSplits) return this.sortedSplits
		const sortedSplits = Array.from(this.splitByFiscalYearAmount.values()).sort((a, b) =>
			a.filed < b.filed ? -1 : 1,
		)
		this.sortedSplits = sortedSplits
		return sortedSplits
	}

	public isSplitProperty(propertyName: string) {
		return propertyName === this.splitKey
	}

	public addSplitData(data: Omit<SplitData, 'firstFiled'>) {
		const { end, filed, fiscalYear, value } = data

		const split = value
		const key = `${fiscalYear}-${split}`
		const prevSplit = this.splitByFiscalYearAmount.get(key)

		if (!prevSplit) {
			this.splitByFiscalYearAmount.set(key, { ...data, firstFiled: filed })
			this.sortedSplits = null
			return
		}

		const curEnd = end
		const curFiled = filed

		const prevEnd = prevSplit.end
		const prevFiled = prevSplit.filed

		const shouldUpdateFactItem = !prevSplit || prevEnd < curEnd || (prevEnd === curEnd && prevFiled > curFiled)
		const shouldUpdateFirstFiled = prevFiled > curFiled

		if (shouldUpdateFactItem) {
			const curData = this.splitByFiscalYearAmount.get(key) as SplitData
			curData.end = end
			curData.filed = filed
			curData.value = value
			curData.fiscalYear = fiscalYear
			this.sortedSplits = null
		}

		if (shouldUpdateFirstFiled) {
			const curData = this.splitByFiscalYearAmount.get(key) as SplitData
			curData.firstFiled = curFiled
			this.sortedSplits = null
		}
	}

	/**
	 * TODO: Find a more reliable way of checking if the split has already been applied.
	 */
	private didApplySplit(params: {
		isShareRatio: boolean
		nextFact: FactItemWithFiscalsNumeric | null
		prevFact: FactItemWithFiscalsNumeric | null
		fact: FactItemWithFiscalsNumeric
		split: SplitData
	}) {
		const { isShareRatio, nextFact, prevFact, fact, split } = params

		const { firstFiled, lastFiled } =
			this.filedFirstLastBySplitKey.get(`${split.fiscalYear}_${split.fiscalPeriod}`) ?? {}

		if (fact.filed > lastFiled!) {
			return true
		}

		if (fact.filed < firstFiled!) {
			return false
		}

		const val = fact.value
		const splitVal = split.value
		const valWithSplit = isShareRatio ? splitVal * val : val / splitVal

		if (nextFact) {
			const difference = Math.abs(nextFact.value - val)
			const differenceSplit = Math.abs(nextFact.value - valWithSplit)
			return difference < differenceSplit
		}

		if (prevFact) {
			const difference = Math.abs(prevFact.value - val)
			const differenceSplit = Math.abs(prevFact.value - valWithSplit)
			return difference < differenceSplit
		}

		return false
	}

	public isSplitAdjustableUnit(unit: string) {
		return unit.toLowerCase().includes('share')
	}

	public isShareRatioUnit(unit: string) {
		const unitLower = unit.toLowerCase()
		return unitLower !== 'shares' && unitLower.includes('share') // ex: USD/shares or USD-per-share
	}

	private getSortedFacts(propertyName: string, isAnnual: boolean) {
		const bucket = isAnnual ? this.factsAnnaulByYearByPropertyName : this.factsByYearQuarterByPropertyName
		const facts = Array.from(bucket.get(propertyName)?.values() ?? [])
		return facts.sort((a, b) => (a.filed < b.filed ? -1 : 1)) ?? []
	}

	public resolveProperty(propertyName: string) {
		if (this.resolvedProperties.has(propertyName)) return

		const factsAscQuarter = this.getSortedFacts(propertyName, false)
		const factsAscAnnual = this.getSortedFacts(propertyName, true)

		this.adjustValuesForSplits({ facts: factsAscQuarter })
		this.adjustValuesForSplits({ facts: factsAscAnnual })

		this.resolvedProperties.add(propertyName)
	}

	public get(propertyName: string, year: number, fiscalPeriod: FiscalPeriod) {
		this.resolveProperty(propertyName)
		const key = `${year}_${fiscalPeriod}`
		const isAnnual = fiscalPeriod === 'FY'
		const bucket = isAnnual ? this.factsAnnaulByYearByPropertyName : this.factsByYearQuarterByPropertyName
		const fact = bucket.get(propertyName)?.get(key)
		return fact?.value
	}

	public forEach(
		callback: (params: { propertyName: string; year: number; fiscalPeriod: FiscalPeriod; value: number }) => void,
	) {
		this.factsByYearQuarterByPropertyName.forEach((factsByYearQuarter, propertyName) => {
			this.resolveProperty(propertyName)
			factsByYearQuarter.forEach((fact, key) => {
				const [year, fiscalPeriod] = key.split('_') as [string, FiscalPeriod]
				callback({ propertyName, year: Number(year), fiscalPeriod, value: Number(fact.value) })
			})
		})

		this.factsAnnaulByYearByPropertyName.forEach((factsByYear, propertyName) => {
			this.resolveProperty(propertyName)
			factsByYear.forEach((fact, key) => {
				const [year, fiscalPeriod] = key.split('_') as [string, FiscalPeriod]
				callback({ propertyName, year: Number(year), fiscalPeriod, value: Number(fact.value) })
			})
		})
	}

	private adjustValuesForSplits(params: { facts: FactItemWithFiscalsNumeric[] }) {
		const { facts } = params
		const splits = this.getSplitsAsc()

		if (facts.length === 0 || splits.length === 0) return

		const isShareRatio = this.isShareRatioUnit(facts[0].unit)

		for (let splitIndex = splits.length - 1; splitIndex >= 0; splitIndex--) {
			const split = splits[splitIndex]

			for (let factIndex = facts.length - 1; factIndex >= 0; factIndex--) {
				const fact = facts[factIndex]
				const { value, filed } = fact

				const nextFact = facts[factIndex + 1] ?? null
				const prevFact = facts[factIndex - 1] ?? null
				// const nextValue = facts[factIndex + 1]?.value ?? null
				// const prevValue = facts[factIndex - 1]?.value ?? null

				const didApplySplit = this.didApplySplit({
					// filed,
					isShareRatio,
					// nextValue,
					// prevValue,
					fact,
					nextFact,
					prevFact,
					split,
					// value,
				})

				if (didApplySplit || !split.value) {
					continue
				}

				if (isShareRatio) {
					fact.value /= split.value
				} else {
					fact.value *= split.value
				}
			}
		}
	}
}

import { FactItem, FactGroup } from '../../types'
import FactFiscalCalculator from './FactFiscalCalculator'
import FactPeriodResolver from './FactPeriodResolver'

/**
 * There are many facts properties for the same period but filed at different times.
 * This groups those together and resolves the period and trailing values for each group.
 */
export default class FactGrouper {
	private createFactGroup(params: Partial<FactGroup>): FactGroup {
		return {
			name: '',
			unit: '',
			reportEnd: '',
			accn: '',
			reportFiled: '',
			isResolverGenerated: true,
			fiscalYear: 0,
			quarter: 0,
			filedFirst: '',
			filedLast: '',
			endFirst: '',
			endLast: '',
			valuePeriodFirst: null,
			valuePeriodLast: null,
			valueTrailingFirst: null,
			valueTrailingLast: null,
			valuePeriodResolved: null,
			valueTrailingResolved: null,
			valueSplitAdjustedPeriod: null,
			valueSplitAdjustedTrailing: null,
			values: [],
			facts: [],
			...params,
		}
	}

	private createGroupKey(params: { fiscalYear: number; quarter: number; name: string }) {
		const { fiscalYear, quarter, name } = params
		return `${fiscalYear}_${quarter}_${name}`
	}

	/**
	 * Map structure { 2022_Q3: { name: ... } }. NOTE: Does not include fiscal year report key.
	 * All groups contain both trailing and period values, so use trailing from Q4 to get FY values.
	 */
	public buildFactGroupsByReportKey(params: {
		facts: FactItem[]
		cik: number
		fiscalCalculator: FactFiscalCalculator
		resolvePeriodValues: boolean
	}) {
		const { facts, cik, fiscalCalculator, resolvePeriodValues } = params

		// min and max year will be used to sort the reports
		let minYear = 0
		let maxYear = 9999

		const factGroupByKey = new Map<string, FactGroup>()
		const periodResolver = new FactPeriodResolver({ cik })

		// used for groups that need to be generated without using a fact
		const unitByPropertyName = new Map<string, string>()
		const accnByFiled = new Map<string, string>()

		// Create groups from facts.
		for (const fact of facts) {
			const { quarter, year } = fiscalCalculator.getFiscalYearQuarter({ dateStr: fact.end })

			const { end: reportEnd = '', filed: reportFiled = '' } =
				fiscalCalculator.getDatesByYearQuarter({ quarter, year }) ?? {}

			const groupKey = this.createGroupKey({ fiscalYear: year, quarter, name: fact.name })

			if (year < minYear) minYear = year
			if (year > maxYear) maxYear = year

			// period checks to see if the fact needs to be resolved for quarterly or trailing values
			const period = periodResolver.getPeriod(fact)
			const isPeriodFact = period <= 3
			const isTrailingFact = period > 3 || (isPeriodFact && quarter === 1)

			const factValue = Number(fact.value)

			// add to the period resolver to resolve quarterly and trailing values
			periodResolver.add({
				quarter,
				end: fact.end,
				filed: fact.filed,
				name: fact.name,
				value: factValue,
				year,
				start: fact.start,
			})

			// if no group exists, create from fact
			if (!factGroupByKey.has(groupKey)) {
				const group = this.createFactGroup({
					name: fact.name,
					accn: periodResolver.isFiledRecent({ end: fact.end, filed: fact.filed }) ? fact.accn : '',
					unit: fact.unit,
					reportEnd: reportEnd,
					reportFiled: reportFiled,
					isResolverGenerated: false,
					fiscalYear: year,
					quarter,
					filedFirst: fact.filed,
					filedLast: fact.filed,
					endFirst: fact.end,
					endLast: fact.end,
					valuePeriodFirst: isPeriodFact ? factValue : null,
					valuePeriodLast: isPeriodFact ? factValue : null,
					valueTrailingFirst: isTrailingFact ? factValue : null,
					valueTrailingLast: isTrailingFact ? factValue : null,
					values: [factValue],
					facts: [fact],
				})

				accnByFiled.set(fact.filed, fact.accn ?? '')
				unitByPropertyName.set(fact.name, fact.unit)
				factGroupByKey.set(groupKey, group)

				continue
			}

			// if group already exists, update values
			const group = factGroupByKey.get(groupKey)!

			group.endFirst = fact.end < group.endFirst ? fact.end : group.endFirst
			group.endLast = fact.end > group.endLast ? fact.end : group.endLast
			group.filedFirst = fact.filed < group.filedFirst ? fact.filed : group.filedFirst
			group.filedLast = fact.filed > group.filedLast ? fact.filed : group.filedLast

			if (!group.accn && periodResolver.isFiledRecent({ end: fact.end, filed: fact.filed })) {
				group.accn = fact.accn ?? ''
				accnByFiled.set(fact.filed, group.accn)
			}

			if (isPeriodFact) {
				if (group.valuePeriodFirst === null) {
					group.valuePeriodFirst = factValue
				}
				if (factValue !== group.valuePeriodFirst && factValue !== group.valuePeriodLast) {
					group.valuePeriodLast = factValue
				}
			}

			if (isTrailingFact) {
				if (group.valueTrailingFirst === null) {
					group.valueTrailingFirst = factValue
				}
				if (factValue !== group.valueTrailingFirst && factValue !== group.valueTrailingLast) {
					group.valueTrailingLast = factValue
				}
			}
		}

		const factGroupsByReportKey = new Map<string, FactGroup[]>()

		// Resolve quarterly and trailing values, and if no facts present for a certain period, create a group with resolved values.
		periodResolver.forEach(({ propertyName, quarter, valueQuarter, valueTrailing, year }) => {
			const groupKey = this.createGroupKey({ fiscalYear: year, name: propertyName, quarter })
			let group = factGroupByKey.get(groupKey)
			if (!group && !resolvePeriodValues) return

			const { end, filed } = fiscalCalculator.getDatesByYearQuarter({ quarter, year }) ?? { end: '', filed: '' }

			const reportKey = `${year}_Q${quarter}`

			const bucket =
				factGroupsByReportKey.get(reportKey) ?? factGroupsByReportKey.set(reportKey, []).get(reportKey)!

			if (!group) {
				group = this.createFactGroup({
					reportEnd: end,
					reportFiled: filed,
					endFirst: end,
					endLast: end,
					accn: accnByFiled.get(filed) ?? '',
					unit: unitByPropertyName.get(propertyName) ?? '',
					isResolverGenerated: true,
					fiscalYear: year,
					quarter: quarter,
					valuePeriodResolved: valueQuarter,
					valueTrailingResolved: valueTrailing,
				})
				factGroupByKey.set(groupKey, group)
			} else if (resolvePeriodValues) {
				group.valuePeriodResolved = valueQuarter
				group.valueTrailingResolved = valueTrailing

				group.valueTrailingFirst ??= valueTrailing
				group.valuePeriodFirst ??= valueQuarter
			}

			bucket.push(group!)
		})

		return { factGroupsByReportKey, minYear, maxYear }
	}
}
import type { CalculationMapCalculation, CalculationMap } from '../../types/calculation-map.type'

interface GetCalculatedFromGroupResult {
	missingKeys: string[] | null
	isMissingRequiredKey: boolean
	hasAtLeastOneKey: boolean
	value: number | null
}

interface GetCalculatedFromGroupParams {
	group: CalculationMapCalculation
	breakIfMissingRequiredKey?: boolean
}

export default class ReportResolvable {
	public readonly report: Record<string, string | number | null | boolean>
	private readonly calculationMap: CalculationMap = {}
	private readonly keyStack = new Set<string>()
	private readonly calculatedValues = new Map<string, { value: number | string | null; groupIndex: number } | null>()
	private readonly usedGroupIndexesByKey = new Map<string, Set<number>>()

	private depth = 0

	constructor(args: {
		report: Record<string, string | number | null | boolean>
		calculationMap?: CalculationMap
		/** Used for member facts */
		pathSeparator?: string
	}) {
		const { report, calculationMap } = args
		this.calculationMap = calculationMap ?? {}
		this.report = report
		this.usedGroupIndexesByKey = new Map<string, Set<number>>()
	}

	public getMap() {
		return this.calculationMap
	}

	public clearCache() {
		this.calculatedValues.clear()
	}

	/**
	 * Used when testing to remove groups that are not being used.
	 */
	public getUsedGroupIndexesByKey() {
		const obj: Record<string, number[]> = {}
		this.usedGroupIndexesByKey.forEach((indexes, key) => (obj[key] = Array.from(indexes)))
		return obj
	}

	/**
	 * Gets value from report, or calculates it using calculationMap.
	 */
	public get(key: string): string | number | null | boolean | undefined {
		this.depth = 0
		return this._get(key)
	}

	/**
	 * Returns 0 for non-numeric values
	 */
	public getNumber(key: string): number {
		return Number(this.get(key)) || 0
	}

	public getCalculatedFromGroup(params: GetCalculatedFromGroupParams): GetCalculatedFromGroupResult {
		this.depth = 0
		return this._getCalculatedFromGroup(params)
	}

	private _get(key: string, parentKey?: string): string | number | null | boolean | undefined {
		return this.report[key] ?? (this._getCalculated(key, parentKey) ?? {}).value
	}

	private _getCalculatedFromGroup(
		params: GetCalculatedFromGroupParams,
		parentKey?: string,
		skipSingleMatch = false,
	): GetCalculatedFromGroupResult {
		const { group, breakIfMissingRequiredKey = true } = params

		const { calculation } = group

		let hasAtLeastOneKey = false
		let isMissingRequiredKey = false
		const missingKeys: string[] = []

		let finalSum = 0

		for (const item of calculation) {
			if (skipSingleMatch && calculation.length < 2) continue
			const { key: childKey, weight, isRequired } = item

			const value = this._get(childKey, parentKey) ?? null
			const hasKey = typeof value === 'number'

			hasAtLeastOneKey = hasAtLeastOneKey || hasKey
			isMissingRequiredKey = isMissingRequiredKey || (isRequired && !hasKey)

			if (!hasKey) {
				missingKeys.push(childKey)
			}

			if (isMissingRequiredKey && breakIfMissingRequiredKey) {
				break
			}

			const valueAdjusted = (Number(value) || 0) * weight

			finalSum += valueAdjusted
		}

		return { hasAtLeastOneKey, isMissingRequiredKey, missingKeys, value: hasAtLeastOneKey ? finalSum : null }
	}

	/**
	 * @param skipSingleMatch When true, skips groups that match only one key. Used for testing groups.
	 */
	public getCalculated(key: string, skipSingleMatch = false) {
		this.depth = 0
		return this._getCalculated(key, undefined, skipSingleMatch) ?? { value: null, groupIndex: -1 }
	}

	private _getCalculated(
		key: string,
		parentKey?: string,
		skipSingleMatch = false,
	): { value: number | string | null | boolean; groupIndex: number } | null {
		this.depth++

		if (this.report[key] !== undefined && !skipSingleMatch) {
			return { value: this.report[key], groupIndex: -1 }
		}

		if (this.calculatedValues.has(key)) {
			const calculatedValue = this.calculatedValues.get(key)!
			const calculatedLength = this.calculationMap[key]?.groups[calculatedValue?.groupIndex]?.calculation.length
			if (!skipSingleMatch || calculatedLength > 1) return calculatedValue
		}

		if (this.keyStack.has(key) || this.depth >= 50) {
			return null
		}

		this.keyStack.add(key)

		const calculationOptions = this.calculationMap[key] ?? { isTranslation: true, groups: [] }

		let result: { value: number; groupIndex: number } | null = null

		const calculationGroups = calculationOptions.groups ?? []

		for (let i = 0; i < calculationGroups.length; i++) {
			const group = calculationGroups[i]

			const { hasAtLeastOneKey, isMissingRequiredKey, value } = this._getCalculatedFromGroup(
				{
					group,
					breakIfMissingRequiredKey: true,
				},
				key,
				skipSingleMatch,
			)

			if (!hasAtLeastOneKey || isMissingRequiredKey || typeof value !== 'number') {
				continue
			}

			const groupResult = { value, groupIndex: i }

			// used for dev purposes to see which groups are being used.
			const indexBucket = (this.usedGroupIndexesByKey.get(key) ??
				this.usedGroupIndexesByKey.set(key, new Set()).get(key))!
			indexBucket.add(i)

			result = groupResult
			break
		}

		if (parentKey === undefined && !skipSingleMatch) {
			this.calculatedValues.set(key, result)
		}

		this.keyStack.delete(key)

		return result
	}

	public toJSON() {
		return this.report
	}
}

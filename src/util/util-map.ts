import type {
	CalculationMap,
	CalculationMapCalculation,
	CalculationMapCalculationItem,
	CalculationMapCondensed,
} from '../types/calculation-map.type'

function expandMap<T>(map: CalculationMapCondensed<T>) {
	const mapExpanded: Partial<CalculationMap<T>> = {}
	for (const key in map) {
		const groups: CalculationMapCalculation[] = []
		for (const group of map[key]) {
			const calculations: CalculationMapCalculationItem[] = []
			for (const calculation of group) {
				const key = calculation[0] as string
				const weight = Number(calculation[1] ?? 1)
				const isRequired = Boolean(calculation[2] ?? false)
				calculations.push({ key, weight, isRequired })
			}
			groups.push({ calculation: calculations })
		}
		mapExpanded[key] = { groups }
	}

	return mapExpanded as CalculationMap<T>
}

function condenseMap<T>(map: CalculationMap<T>): CalculationMapCondensed<T> {
	const mapCondensed: Partial<CalculationMapCondensed<T>> = {}
	for (const key in map) {
		const groupsArr: (string | number)[][][] = []
		for (const group of map[key].groups) {
			const groupArr: (string | number)[][] = []
			for (const { key, weight, isRequired } of group.calculation) {
				const row: (string | number)[] = [key, weight, Number(isRequired)]
				groupArr.push(row)
			}
			groupsArr.push(groupArr)
		}
		mapCondensed[key] = groupsArr
	}

	return mapCondensed as CalculationMapCondensed<T>
}

/**
 * Used for expanding and condensing calculation maps. Calculation maps are used in secEdgarApi.getReports
 * to map values from the SEC to the reports.
 */
export const utilMap = {
	expandMap,
	condenseMap,
}

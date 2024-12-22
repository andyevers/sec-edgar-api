// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CalculationMap<T = any> = Record<keyof T, CalculationMapItem>

export interface CalculationMapCalculationItem {
	key: string
	weight: number
	isRequired: boolean
}

export interface CalculationMapCalculation {
	calculation: CalculationMapCalculationItem[]
}

export interface CalculationMapItem {
	groups: CalculationMapCalculation[]
}

export type CalculationMapCondensed<T = object> = Record<keyof T, (string | number)[][][]>

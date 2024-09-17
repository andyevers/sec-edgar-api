import { ReportRaw } from '../../types'
import { calculationMapByNs } from '../../util/calculation-map-by-ns'

export type TemplateCode = 'I' | 'T' | 'B' | 'M' | 'N' | 'U'
export default class ReportRawResolvable {
	public readonly report: ReportRaw
	private readonly emptyKeys: Set<string> = new Set()
	private readonly addedProps = new Set<string>()
	private readonly calcMap: Record<string, Record<string, string[]>>
	private readonly templateCode: TemplateCode

	private readonly keyStack = new Set<string>()

	constructor(report: ReportRaw, templateCode: TemplateCode | null = null, calcMap = calculationMapByNs) {
		this.templateCode = templateCode ?? 'N'
		this.report = report
		this.calcMap = calcMap
	}

	public get(key: string) {
		return this.report[key] ?? this.calculateNumericKey(key, key)
	}

	public getNumber(key: string) {
		return Number(this.get(key)) || 0
	}

	public isAdded(key: string) {
		return this.addedProps.has(key)
	}

	private getChildKeysArr(key: string) {
		const calcsByRole = this.calcMap[key]
		if (calcsByRole === undefined) {
			return []
		}

		if (calcsByRole._) {
			return [calcsByRole._]
		}
		let preferredKeys: string[] = []

		switch (this.templateCode) {
			case 'I':
				preferredKeys = [
					'StatementOfCashFlowsIndirectInvestmentBasedOperations',
					'StatementOfFinancialPositionUnclassified-InvestmentBasedOperations',
					'StatementOfCashFlowsIndirectDepositBasedOperations',
					'StatementOfFinancialPositionUnclassified-DepositBasedOperationsFirstAlternate',
					'StatementOfFinancialPositionUnclassified-DepositBasedOperations',
				]
				break
			case 'B':
				preferredKeys = [
					'StatementOfFinancialPositionUnclassified-DepositBasedOperationsFirstAlternate',
					'StatementOfFinancialPositionUnclassified-DepositBasedOperations',
				]
				break
		}

		let k = preferredKeys.find((k) => calcsByRole[k])

		if (!k) {
			k = Object.keys(calcsByRole)[0]
		}

		return Object.keys(calcsByRole)
			.sort((a, b) => {
				const indexA = preferredKeys.indexOf(a)
				const indexB = preferredKeys.indexOf(b)
				if (indexB === -1) return -1
				if (indexA === -1) return 1
				return indexA - indexB
			})
			.map((k) => calcsByRole[k])
	}

	private calculateNumericKey(key: string, topLevelKey: string): number | undefined {
		if (this.keyStack.has(key)) {
			return undefined
		}

		this.keyStack.add(key)

		if (this.emptyKeys.has(key)) {
			return undefined
		}

		const childKeysArr = this.getChildKeysArr(key)

		if (childKeysArr.length === 0) {
			return undefined
		}

		let didAdd = false

		let finalSum = 0
		for (const childKeys of childKeysArr) {
			let sum = 0

			for (const k of childKeys) {
				const [childKey, weightStr] = k.split('|')
				const value = this.report[childKey] ?? this.calculateNumericKey(childKey, topLevelKey)

				if (typeof value !== 'number') {
					continue
				}
				didAdd = true
				sum += value * Number(weightStr)
			}

			if (sum === 0) {
				continue
			}
			finalSum = sum
			break
		}

		if (!didAdd) {
			this.emptyKeys.add(key)
			return undefined
		}

		this.report[key] = finalSum
		this.addedProps.add(key)

		return finalSum
	}

	public toJSON() {
		return this.report
	}
}

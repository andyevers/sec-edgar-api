import { CompanyFactListData, FactValue } from '../../types/company-facts.type'

export interface IterateFactsCallbackData {
	factValue: FactValue
	propertyName: string
	description: string
	label: string
	unit: string
	taxonomy: string
	stopIteration: () => void
}

export default class FactIterator {
	/**
	 * Avoids deep nesting logic while iteratating through company facts
	 *
	 * @param callback called on each company fact.
	 */
	public iterateCompanyFacts(
		companyFactListData: Pick<CompanyFactListData, 'facts'>,
		callback: (data: IterateFactsCallbackData) => void,
	) {
		const { facts } = companyFactListData

		let shouldContinue = true
		const stopIteration = () => {
			shouldContinue = false
		}

		for (const taxonomy in facts) {
			const factByPropertyName = facts[taxonomy as keyof typeof facts]

			for (const propertyName in factByPropertyName) {
				const { description, label, units } = factByPropertyName[propertyName]

				for (const unit in units) {
					const factValues = units[unit]

					for (const factValue of factValues) {
						callback({ factValue, taxonomy, propertyName, unit, description, label, stopIteration })

						if (!shouldContinue) return
					}
				}
			}
		}
	}
}

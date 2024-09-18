import { FactItem } from './ReportBuilder'
import { CompanyFactListData } from '../../types'

/**
 * Builds an array of fact records.
 */
export default class FactRecordBuilder {
	public createFacts(data: CompanyFactListData, filterDuplicates = false) {
		const { facts, cik } = data

		const factsByKey = new Map<string | number, FactItem>()

		let keyIndex = 0
		const createKey = (params: { start?: string; end: string; filed: string; propertyName: string }) => {
			if (!filterDuplicates) return keyIndex++
			const { start, end, filed, propertyName } = params
			return `${start ?? ''}_${end}_${filed}_${propertyName}`
		}

		for (const prefix in facts) {
			const factByPropertyName = facts[prefix as keyof typeof facts]

			for (const propertyName in factByPropertyName) {
				const { units } = factByPropertyName[propertyName]

				for (const unit in units) {
					const factValues = units[unit]

					for (const factValue of factValues) {
						const { end, start, val, filed, accn, form, fp, frame, fy } = factValue

						const mapKey = createKey({ propertyName, end, filed, start })

						const name = `${prefix}:${propertyName}`
						const item: FactItem = {
							cik,
							end,
							filed,
							name,
							unit,
							value: val,
							accn: accn,
						}

						if (start) item.start = start
						if (accn) item.accn = accn
						if (form) item.form = form
						if (fp) item.fp = fp
						if (frame) item.frame = frame
						if (fy) item.fy = fy

						const prevFact = factsByKey.get(mapKey)
						if (!prevFact) {
							factsByKey.set(mapKey, item)
							continue
						}

						// use whichever is closer to the report end date
						const shouldPush =
							new Date(item.filed).getTime() - new Date(item.end).getTime() <
							new Date(prevFact.filed).getTime() - new Date(prevFact.end).getTime()

						if (shouldPush) {
							factsByKey.set(mapKey, item)
						}
					}
				}
			}
		}

		return { facts: Array.from(factsByKey.values()) }
	}
}

import { FactItem } from './ReportBuilder'
import { CompanyFactListData } from '../../types'

export default class FactRecordBuilder {
	public createFacts(data: CompanyFactListData) {
		const { facts, cik } = data

		const factItems: FactItem[] = []

		for (const prefix in facts) {
			const factByPropertyName = facts[prefix as keyof typeof facts]

			for (const propertyName in factByPropertyName) {
				const { units } = factByPropertyName[propertyName]

				for (const unit in units) {
					const factValues = units[unit]

					for (const factValue of factValues) {
						const { end, start, val, filed, accn, form, fp, frame, fy } = factValue
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

						factItems.push(item)
					}
				}
			}
		}

		return { facts: factItems }
	}
}

import { ReportTranslated } from '../../types'

type ExtendableReportProxy = {
	new (report: ReportTranslated): ReportTranslated
}

class _ReportTranslatedProxy {
	private readonly changedKeys: Set<keyof ReportTranslated>

	constructor(report: ReportTranslated) {
		this.changedKeys = new Set()
		const reportKeys = new Set(Object.keys(report))

		return new Proxy(this, {
			// when accessing property of report, return the value of the report instead of the wrapper
			get(target, key, receiver) {
				return reportKeys.has(String(key)) ? Reflect.get(report, key) : Reflect.get(target, key, receiver)
			},
			// record changed properties
			set(target, key, value, receiver) {
				if (reportKeys.has(String(key))) {
					target.changedKeys.add(String(key) as keyof ReportTranslated)
					return Reflect.set(report, key, value)
				}
				return Reflect.set(target, key, value, receiver)
			},
			// makes Object.keys return report keys
			ownKeys() {
				return Reflect.ownKeys(report)
			},
			getOwnPropertyDescriptor(target, key) {
				return reportKeys.has(String(key))
					? Reflect.getOwnPropertyDescriptor(report, key)
					: Reflect.getOwnPropertyDescriptor(target, key)
			},
		})
	}

	public getChangedKeys() {
		return Array.from(this.changedKeys)
	}
}

/**
 * Used to make ReportWrapper implement ReportTranslated interface via proxy
 */
const ReportTranslatedProxy = _ReportTranslatedProxy as unknown as ExtendableReportProxy

export default ReportTranslatedProxy

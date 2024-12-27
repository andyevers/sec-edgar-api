/* eslint-disable @typescript-eslint/no-explicit-any */
function toArray<T>(value: T): T {
	return (Array.isArray(value) ? value : [value]).filter(Boolean) as T
}

function toNumber(value: any): number {
	return Number(value)
}

function toObject<T>(value: T): T {
	value = Array.isArray(value) ? value[0] : value
	return (value && typeof value === 'object' ? value : {}) as T
}

function toString(value: any): string {
	value = typeof value === 'object' && value !== null ? value['#text'] ?? value : value
	return String(value || '')
}

function toBoolean(value: any): boolean {
	return typeof value === 'string' ? value.toLowerCase() === 'true' || value === '1' : Boolean(value)
}

function parseKey(key: string) {
	return key.split(':').pop()?.replace('@_', '').replace('#', '') ?? ''
}

function extractXbrlObject(value: any) {
	let xbrl = value
	if (typeof xbrl !== 'object' || xbrl === null) {
		return null
	}
	for (let i = 0; i < 10; i++) {
		const xbrlChild = xbrl.XBRL ?? xbrl.xbrl ?? xbrl['xbrli:xbrl'] ?? xbrl['xbrli:XBRL']
		if (xbrlChild) xbrl = xbrlChild
		else break
	}

	return xbrl
}

const utilXbrl = {
	toArray,
	toNumber,
	toObject,
	toString,
	toBoolean,
	parseKey,
	extractXbrlObject,
}

export default utilXbrl

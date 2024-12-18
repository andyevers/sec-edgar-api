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

const utilType = {
	toArray,
	toNumber,
	toObject,
	toString,
	toBoolean,
	parseKey,
}

export default utilType

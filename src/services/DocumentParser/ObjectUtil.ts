/* eslint-disable @typescript-eslint/no-explicit-any */
interface IterateDeepData {
	key: string
	value: any
	currentObj: ObjOrArr
	originalObj: ObjOrArr
	path: string
	pathSeparator: string
	nextKey: () => void
	breakLoop: () => void
}

type ObjOrArr = Record<string | symbol | number, any> | any[]

export default class ObjectUtil {
	private readonly pathSeparator: string
	constructor(args?: { pathSeparator?: string }) {
		const { pathSeparator = '>' } = args ?? {}
		this.pathSeparator = pathSeparator
	}

	public iterateKeysDeep(obj: ObjOrArr, cb: (data: IterateDeepData) => void | boolean) {
		const originalObj = obj

		let isBreak = false
		const breakLoop = () => (isBreak = true)

		// prevents original object from being modified
		const _iterateKeys = (obj: ObjOrArr, cb: (data: IterateDeepData) => void, path: string) => {
			let isNextKey = false
			const nextKey = () => (isNextKey = true)

			for (const key of Object.keys(obj)) {
				isNextKey = false
				const value = (obj as any)[key]

				const p = path ? `${path}${this.pathSeparator}${key}` : key
				cb({
					key,
					value,
					currentObj: obj,
					originalObj,
					pathSeparator: this.pathSeparator,
					path: p,
					nextKey,
					breakLoop,
				})

				if (isBreak) return
				if (isNextKey) continue

				const isObjOrArr = typeof value === 'object' && value !== null
				if (isObjOrArr) _iterateKeys((obj as any)[key], cb, p)
			}
		}

		_iterateKeys(obj, cb, '')
	}

	public setPath(obj: object, path: string, value: any, pathSeparator?: string) {
		const keys = path.split(pathSeparator ?? this.pathSeparator)
		let ref: any = obj

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i]
			if (i === keys.length - 1) {
				ref[key] = value
			} else {
				ref[key] ??= {}
				ref = ref[key]
			}
		}
	}
}

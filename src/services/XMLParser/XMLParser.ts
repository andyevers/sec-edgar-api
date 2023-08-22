interface OnMapPathData {
	path: string
	pathOccurrenceCount: number
	text: string
	index: number
}

interface ParseParams {
	xml: string
	onMapPath?: (data: OnMapPathData) => void
}

export default class XMLParser {
	public parse(params: ParseParams) {
		const { xml, onMapPath } = params
		const selfEnclosingTags = new Set([
			'br',
			'meta',
			'link',
			'img',
			'input',
			'hr',
			'area',
			'base',
			'col',
			'command',
			'embed',
			'keygen',
			'param',
			'source',
			'track',
			'wbr',
		])

		const pathOccurrenceCountMap = new Map<string, number>()
		let curPath: string = ''
		let curTag: string = ''
		let curText: string = ''
		let didStart = false

		const pathsArr: string[] = []
		const textArr: string[] = []

		for (let i = 0; i < xml.length; i++) {
			const char = xml[i]

			if (char === '<' && xml[i + 1] !== '/' && xml[i + 1] !== '?' && xml[i + 1] !== '!') {
				didStart = true
				i++
				let j = 0
				let didEndTagName = false
				while (xml[i] !== '>') {
					didEndTagName =
						didEndTagName ||
						xml[i] === ' ' ||
						xml[i] === '\n' ||
						xml[i] === '\r' ||
						xml[i] === '\t' ||
						xml[i] === '/'

					if (!didEndTagName) {
						curTag += xml[i]
					}

					i++
					j++
					if (j > 1000) {
						throw new Error('too many iterations')
					}
				}

				// map path for non-self-enclosing tags
				if (!selfEnclosingTags.has(curTag)) {
					curPath = `${curPath}${curPath.length > 0 ? '.' : ''}${curTag}`
					pathsArr.push(curPath)
				}

				curTag = ''
			} else if (char === '<' && xml[i + 1] === '/') {
				curText = curText.trim()
				const pathOccurrenceCount = pathOccurrenceCountMap.get(curPath) ?? 0
				pathOccurrenceCountMap.set(curPath, pathOccurrenceCount + 1)

				onMapPath?.({
					path: curPath,
					pathOccurrenceCount,
					index: i,
					text: curText,
				})

				textArr[pathsArr.lastIndexOf(curPath)] = curText
				curPath = curPath.slice(0, curPath.lastIndexOf('.'))

				while (xml[i] !== '>') {
					i++
				}
				curText = ''
			} else if (didStart) {
				curText += char
			}
		}

		return {
			pathsArr,
			textArr,
		}
	}
}

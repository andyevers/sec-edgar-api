interface OnCharacterData {
	char: string
	index: number
	path: string
	pathOccurrenceCount: number
}

interface Parse2Params {
	xml: string
	onCharacter?: (data: OnCharacterData) => void
	onOpenTag?: (data: OnCharacterData) => void
	onCloseTag?: (data: OnCharacterData) => void
}

interface IterateTablesParams {
	xml: string
	parentPath?: string
	trimSpaces?: boolean
}

export default class XMLParser {
	public iterateXML(params: Parse2Params): string[] {
		const { xml, onCharacter, onCloseTag, onOpenTag } = params
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
		let didStart = false

		const pathsArr: string[] = []

		for (let i = 0; i < xml.length; i++) {
			const char = xml[i]

			if (char === '<' && xml[i + 1] !== '/' && xml[i + 1] !== '?' && xml[i + 1] !== '!') {
				let iOpen = i
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
					const pathOccurrenceCount = pathOccurrenceCountMap.get(curPath) ?? 0
					pathOccurrenceCountMap.set(curPath, pathOccurrenceCount + 1)
					pathsArr.push(curPath)

					onOpenTag?.({
						char: char,
						index: iOpen,
						path: curPath,
						pathOccurrenceCount: pathOccurrenceCountMap.get(curPath) ?? 0,
					})
				}

				curTag = ''
			} else if (char === '<' && xml[i + 1] === '/') {
				while (xml[i] !== '>') {
					i++
				}

				onCloseTag?.({
					char: char,
					index: i,
					path: curPath,
					pathOccurrenceCount: pathOccurrenceCountMap.get(curPath) ?? 0,
				})

				curPath = curPath.slice(0, curPath.lastIndexOf('.'))
			} else if (didStart) {
				onCharacter?.({
					char: char,
					index: i,
					path: curPath,
					pathOccurrenceCount: pathOccurrenceCountMap.get(curPath) ?? 0,
				})
			}
		}

		return pathsArr
	}

	/**
	 * Returns text in each table cell mapped by `${table}.${row}.${col}`
	 */
	public getTableTextMap(params: IterateTablesParams) {
		const { xml, parentPath = 'html.body', trimSpaces = true } = params

		const rowPaths = new Set([
			`${parentPath}.table.tbody.tr`,
			`${parentPath}.table.thead.tr`,
			`${parentPath}.table.tfoot.tr`,
			`${parentPath}.table.tr`,
		])

		const colPaths = new Set([
			`${parentPath}.table.tbody.tr.td`,
			`${parentPath}.table.thead.tr.td`,
			`${parentPath}.table.tfoot.tr.td`,
			`${parentPath}.table.tr.td`,
			`${parentPath}.table.tbody.tr.th`,
			`${parentPath}.table.thead.tr.th`,
			`${parentPath}.table.tfoot.tr.th`,
			`${parentPath}.table.tr.th`,
		])

		let table = 0
		let row = 0
		let col = 0

		const textByColKey = new Map<string, string>()
		const spaceChars = new Set(['\n', '\r', '\t'])

		this.iterateXML({
			xml,
			onOpenTag: ({ path }) => {
				const colKey = `${table}.${row}.${col}`
				const textCur = textByColKey.get(colKey) ?? ''
				if (textCur.trim().length === 0 && col === 0) {
					textByColKey.delete(colKey)
				}

				if (path === `${parentPath}.table`) {
					table++
					col = 0
					row = 0
				} else if (rowPaths.has(path)) {
					row++
					col = 0
				} else if (colPaths.has(path)) {
					col++
				}
			},
			onCharacter: ({ char }) => {
				char = spaceChars.has(char) ? ' ' : char
				const colKey = `${table}.${row}.${col}`
				const textCur = textByColKey.get(colKey) ?? ''
				if (trimSpaces && char === ' ' && textCur.endsWith(' ')) return
				textByColKey.set(colKey, `${textCur}${char}`)
			},
			onCloseTag: () => {
				const colKey = `${table}.${row}.${col}`
				const textCur = textByColKey.get(colKey) ?? ''
				if (textCur.trim().length === 0 && col === 0) {
					textByColKey.delete(colKey)
				} else if (!textCur.endsWith(' ')) {
					textByColKey.set(colKey, `${textCur} `)
				}
			},
		})

		return textByColKey
	}
}

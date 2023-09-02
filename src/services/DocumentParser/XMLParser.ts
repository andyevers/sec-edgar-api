import { ColNode } from './XMLNode/ColNode'
import { DocumentNode } from './XMLNode/DocumentNode'
import { HRNode } from './XMLNode/HRNode'
import { NonTableNode } from './XMLNode/NonTableNode'
import { RowNode } from './XMLNode/RowNode'
import { TableNode } from './XMLNode/TableNode'
import { XMLNode } from './XMLNode/XMLNode'

interface OnCharacterData {
	char: string
	index: number
	path: string
	pathOccurrenceCount: number
	attributesStr: string
}

interface ParseTableNodesParams {
	xml: string
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
	onCharacter?: (data: OnCharacterData & { textMap: Map<string, string> }) => void
	onOpenTag?: (data: OnCharacterData & { textMap: Map<string, string> }) => void
	onCloseTag?: (data: OnCharacterData & { textMap: Map<string, string> }) => void
}

export default class XMLParser {
	public iterateXML(params: Parse2Params): string[] {
		const { xml, onCharacter, onCloseTag, onOpenTag } = params

		const selfEnclosingTags = new Set([
			'filename',
			'description',
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
		const spaceChars = new Set(['\n', '\r', '\t', ' '])

		const pathOccurrenceCountMap = new Map<string, number>()
		let curPath: string = ''
		let curTag: string = ''
		let curAttributes: string = ''
		let didStart = false

		const pathsArr: string[] = []

		for (let i = 0; i < xml.length; i++) {
			const char = xml[i]
			const isOpenTag = char === '<' && xml[i + 1] !== '/' && xml[i + 1] !== '?' && xml[i + 1] !== '!'
			const isCloseTag = char === '<' && xml[i + 1] === '/'

			const onCharacterData: OnCharacterData = {
				char: char,
				index: i,
				path: curPath,
				pathOccurrenceCount: pathOccurrenceCountMap.get(curPath) ?? 0,
				attributesStr: curAttributes,
			}

			if (isOpenTag) {
				let didEndTagName = false
				let j = 0

				didStart = true
				i++
				while (xml[i] !== '>') {
					didEndTagName = didEndTagName || spaceChars.has(xml[i]) || xml[i] === '/'
					if (!didEndTagName) {
						curTag += xml[i].toLowerCase()
					} else if (xml[i] !== '/') {
						curAttributes += xml[i]
					}

					i++
					j++
					if (j > 1_000_000) {
						throw new Error('too many iterations')
					}
				}

				const pathNew = `${curPath}${curPath.length > 0 ? '.' : ''}${curTag}`.toLowerCase()
				const countBefore = pathOccurrenceCountMap.get(pathNew) ?? 0
				const pathOccurrenceCount = pathOccurrenceCountMap.set(pathNew, countBefore + 1).get(pathNew) ?? 0

				onCharacterData.path = pathNew
				onCharacterData.pathOccurrenceCount = pathOccurrenceCount
				onCharacterData.attributesStr = curAttributes

				pathsArr.push(pathNew)

				onOpenTag?.(onCharacterData)
				if (selfEnclosingTags.has(curTag)) {
					onCloseTag?.(onCharacterData)
				} else {
					curPath = pathNew
				}

				curTag = ''
			} else if (isCloseTag) {
				while (xml[i] !== '>') {
					i++
				}

				onCloseTag?.(onCharacterData)
				curPath = curPath.slice(0, curPath.lastIndexOf('.'))
				curAttributes = ''
			} else if (didStart) {
				onCharacter?.(onCharacterData)
			}
		}

		return pathsArr
	}

	/**
	 * Returns text in each table cell mapped by `${table}.${row}.${col}`
	 */
	public getTableTextMap(params: IterateTablesParams) {
		const { xml, parentPath, onCharacter, onCloseTag, onOpenTag, trimSpaces = true } = params

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
			onOpenTag: (data) => {
				const { path } = data
				const colKey = `${table}.${row}.${col}`
				const textCur = textByColKey.get(colKey) ?? ''
				const pathLower = path.toLowerCase()

				if (textCur.trim().length === 0 && col === 0) {
					textByColKey.delete(colKey)
				}

				const isTable = parentPath ? pathLower === `${parentPath}.table` : pathLower.endsWith('table')
				const isRow = parentPath ? rowPaths.has(pathLower) : pathLower.endsWith('tr')
				const isCol = parentPath
					? colPaths.has(pathLower)
					: pathLower.endsWith('td') || pathLower.endsWith('th')

				if (isTable) {
					table++
					col = 0
					row = 0
				} else if (isRow) {
					row++
					col = 0
				} else if (isCol) {
					col++
				}
				onOpenTag?.({ ...data, textMap: textByColKey })
			},
			onCharacter: (data) => {
				const char = spaceChars.has(data.char) ? ' ' : data.char
				const colKey = `${table}.${row}.${col}`
				const textCur = textByColKey.get(colKey) ?? ''
				if (!(trimSpaces && char === ' ' && textCur.endsWith(' '))) {
					textByColKey.set(colKey, `${textCur}${char}`)
				}
				onCharacter?.({ ...data, textMap: textByColKey })
			},
			onCloseTag: (data) => {
				const colKey = `${table}.${row}.${col}`
				const textCur = textByColKey.get(colKey) ?? ''
				if (textCur.trim().length === 0 && col === 0) {
					textByColKey.delete(colKey)
				} else if (!textCur.endsWith(' ')) {
					textByColKey.set(colKey, `${textCur} `)
				}
				onCloseTag?.({ ...data, textMap: textByColKey })
			},
		})

		return textByColKey
	}

	public getDocumentNode(params: ParseTableNodesParams) {
		const { xml } = params

		const rowsArr: XMLNode[] = []
		const colsArr: XMLNode[] = []
		const documentNode = new DocumentNode()

		const countRowsToPushByCol = new Map<ColNode, number>()

		let curNode: XMLNode | null = null
		let prevRowCols: (ColNode | null)[] = []
		let curRowCols: (ColNode | null)[] = []
		let isBold = false
		let boldPath: string | null = null

		const pushColToRow = (col: ColNode) => {
			// push cols from prev rows that span multiple rows
			const prevColsSpanningRows = Array.from(countRowsToPushByCol.entries()).sort(
				(a, b) => a[0].getIndex() - b[0].getIndex(),
			)

			prevColsSpanningRows.forEach(([colPrev, count]) => {
				if (colPrev.getIndex() > curRowCols.length || curRowCols.includes(colPrev)) return
				countRowsToPushByCol.set(colPrev, count - 1)
				Array.from({ length: colPrev.getColSpan() }).forEach(() => curRowCols.push(colPrev))
				if (count <= 0) countRowsToPushByCol.delete(colPrev)
			})

			const colIndex = curRowCols.length
			col.setIndex(colIndex)

			const colSpan = col.getColSpan()
			const rowSpan = col.getRowSpan()
			if (rowSpan > 1) countRowsToPushByCol.set(col, rowSpan)

			Array.from({ length: colSpan }).forEach(() => curRowCols.push(col))

			const topSibling = prevRowCols[colIndex] ?? null
			topSibling?.addBottomSibling(col)
		}

		this.iterateXML({
			xml,
			onCloseTag: () => {
				if (curNode?.getPath() === boldPath) {
					curNode?.setText(`${curNode?.getText() ?? ''}}}`)
					boldPath = null
				}
			},
			onCharacter: ({ char }) => {
				curNode?.setText((curNode?.getText() ?? '') + char)
			},
			onOpenTag: ({ path, attributesStr }) => {
				// skip nested tables
				if (path.split('.').reduce((acc, cur) => (cur === 'table' ? acc + 1 : acc), 0) > 1) return

				const tag = path.split('.').pop()
				const isInTable = path.includes('table')
				const topLevelNodes = documentNode.getChildren()
				const prevTopLevelNode = topLevelNodes[topLevelNodes.length - 1]
				const wasHorizontalLine = prevTopLevelNode instanceof HRNode
				const wasNonTableNode = prevTopLevelNode instanceof NonTableNode
				const wasBold = isBold

				const attributesLower = attributesStr.toLowerCase().replace(/\s/g, '')
				isBold =
					tag === 'b' ||
					tag === 'strong' ||
					attributesLower.includes('font-weight:bold') ||
					attributesLower.includes('font-weight:700') ||
					attributesLower.includes('font-weight:800') ||
					attributesLower.includes('font-weight:900')

				if (!isInTable) {
					prevRowCols = []
					curRowCols = []
				}

				if (tag === 'hr' && !isInTable) {
					const hr = new HRNode({ attributesStr, path })
					hr.setPreviousSibling(prevTopLevelNode ?? null)
					topLevelNodes.push(hr)
					curNode = hr
				} else if (tag === 'table') {
					const table = new TableNode({ attributesStr, path })
					table.setPreviousSibling(prevTopLevelNode ?? null)
					topLevelNodes.push(table)
					curNode = table
				} else if (tag === 'tr') {
					const row = new RowNode({ attributesStr, path })
					const prevRow = rowsArr[rowsArr.length - 1]
					row.setParent(prevTopLevelNode)
					row.setPreviousSibling(prevRow?.getParent() === row.getParent() ? prevRow : null)
					rowsArr.push(row)
					prevRowCols = curRowCols
					curRowCols = []
					curNode = row
				} else if (tag === 'td' || tag === 'th') {
					const col = new ColNode({ attributesStr, path })
					const prevCol = colsArr[colsArr.length - 1]
					col.setParent(rowsArr[rowsArr.length - 1])
					col.setPreviousSibling(prevCol?.getParent() === col.getParent() ? prevCol : null)
					colsArr.push(col)
					pushColToRow(col)
					curNode = col
				} else if ((!isInTable && !wasNonTableNode) || (wasHorizontalLine && tag !== 'hr')) {
					const node = new NonTableNode({ attributesStr, path })
					node.setPreviousSibling(prevTopLevelNode ?? null)
					topLevelNodes.push(node)
					curNode = node
				} else if (curNode && !curNode.getText().endsWith('\n')) {
					curNode.setText(`${curNode.getText().trim()}\n`)
				}

				if (isBold && !wasBold && !curNode?.getText().endsWith('{{')) {
					curNode?.setText(`${curNode?.getText().trim()}{{`)
				}

				if (isBold) {
					boldPath = curNode?.getPath() ?? null
				}
			},
		})

		documentNode.setText(xml)

		return documentNode
	}
}

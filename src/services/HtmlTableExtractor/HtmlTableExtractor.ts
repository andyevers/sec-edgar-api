export interface Cell {
	attributes: string
	rowSpan: number
	colSpan: number
	rowIndex: number
	colIndex: number
	tableCellIndex: number
	html: string
	isHeaderRowCell: boolean
	isBodyTitleRowCell: boolean
	valueParsed: string | number | null
	headerCol: string | null
	headerRowIndex: number | null
}

export interface TableHTMLData {
	tableIndex: number
	parentTableIndex: number | null
	childTableIndexes: number[]
	positionStart: number
	positionEnd: number
	htmlBefore: string
	html: string
	rows: Cell[][]
}

interface ParseOptions {
	tagsToExclude?: string[]
	stripParenthesis?: boolean
	removeEmptyColumns?: boolean
	stripHtml?: boolean
	getHeaderRowIndex?: (data: {
		rows: Omit<Cell, 'headerRowIndex' | 'isHeaderRowCell' | 'isBodyRowCell' | 'headerCol'>[][]
		table: TableHTMLData
	}) => number
}

export default class HtmlTableExtractor {
	public extractTables(html: string, options?: ParseOptions): TableHTMLData[] {
		const tablesOpen: TableHTMLData[] = []

		let tableIndex = -1
		let htmlBefore = ''

		const tablesData: TableHTMLData[] = []
		for (let i = 0; i < html.length; i++) {
			const isTableStart = html.substring(i, i + 6).toLowerCase() === '<table'
			const isTableEnd = html.substring(i - 7, i + 1).toLowerCase() === '</table>'
			const parentTable = tablesOpen[tablesOpen.length - 1]

			if (isTableStart) {
				tableIndex++
				tablesOpen.push({
					tableIndex,
					parentTableIndex: parentTable?.tableIndex ?? null,
					childTableIndexes: [],
					positionStart: i,
					positionEnd: -1,
					htmlBefore,
					html: '',
					rows: [],
				})

				parentTable?.childTableIndexes.push(tableIndex)
				htmlBefore = ''
			}

			if (tablesOpen.length === 0) {
				htmlBefore += html[i]
			}

			for (let a = tablesOpen.length - 1; a >= 0; a--) {
				tablesOpen[a].html += html[i]
			}

			if (isTableEnd && tablesOpen.length > 0) {
				tablesOpen[tablesOpen.length - 1].positionEnd = i
				const tableData = tablesOpen.pop() as TableHTMLData
				// tablesData[tableData.tableIndex] = tableData
				tablesData.push(tableData)
			}
		}

		this.addTableCells(tablesData)
		this.addTableCellValues(tablesData, options)
		this.addMissingNameCol(tablesData)
		if (options?.removeEmptyColumns ?? true) {
			this.removeEmptyColumns(tablesData)
		}
		this.mergeHeaderRows(tablesData)

		return tablesData.filter(Boolean)
	}

	public mergeHeaderRows(tables: TableHTMLData[]) {
		for (const table of tables) {
			const bodyRowIndex = table.rows.findIndex((row) => row.some((col) => !col.isHeaderRowCell))
			const headerRowIndex = bodyRowIndex - 1
			const bodyRow = table.rows[bodyRowIndex]
			const headerRow = table.rows[headerRowIndex]
			if (!bodyRow || headerRowIndex < 0) continue

			for (let i = 0; i < bodyRow.length; i++) {
				const headerCol = headerRow[i]
				const bodyCol = bodyRow[i]
				if (!headerCol || !bodyCol) continue
				headerCol.valueParsed = bodyCol.headerCol ?? headerCol?.valueParsed
			}
		}
	}

	public removeEmptyColumns(tables: TableHTMLData[]) {
		for (const table of tables) {
			const emptyColumns = new Set<number>()

			for (let c = 0; c < table.rows[0]?.length; c++) {
				const isAllEmpty = table.rows.every((row) => row[c]?.valueParsed === null || row[c]?.isHeaderRowCell)
				if (isAllEmpty) {
					emptyColumns.add(c)
				}
			}

			for (let r = 0; r < table.rows.length; r++) {
				const row = table.rows[r]
				table.rows[r] = row.filter((_, i) => !emptyColumns.has(i))
			}

			table.rows = table.rows.filter((row) => row.some((col) => col.valueParsed !== null))
		}

		return tables
	}

	private addTableCells(tables: TableHTMLData[]): void {
		if (tables.length === 0) return
		const tablesByIndex = new Map(tables.map((t) => [t.tableIndex, t]))

		tablesByIndex.forEach((table) => {
			const skipIndexMap = new Map(
				table.childTableIndexes.map((childIndex) => {
					const child = tablesByIndex.get(childIndex)
					return [
						(child?.positionStart ?? 0) - table.positionStart,
						(child?.positionEnd ?? 0) - table.positionStart,
					]
				}),
			)

			const grid: Cell[][] = []

			let isInCell = false
			let isInCellAtts = false

			let cellAtts = ''
			let cellHTML = ''

			let rowIndex = -1
			let tableCellIndex = -1

			const createCell = (html: string, atts: string) => {
				const attributePairs = atts
					.toLowerCase()
					.split(' ')
					.map((att) => att.split('='))

				const rowSpan =
					Number(attributePairs.find(([key]) => key === 'rowspan')?.[1]?.replace(/[^0-9]/g, '')) || 1
				const colSpan =
					Number(attributePairs.find(([key]) => key === 'colspan')?.[1]?.replace(/[^0-9]/g, '')) || 1

				const cell: Cell = {
					attributes: atts.length > 4 ? atts.substring(4, atts.length - 1) : '',
					html,
					colSpan,
					rowSpan,
					tableCellIndex,
					rowIndex,
					colIndex: -1,
					isHeaderRowCell: false,
					isBodyTitleRowCell: false,
					valueParsed: null,
					headerCol: null,
					headerRowIndex: null,
				}

				// const hasCopies = cell.colSpan > 1 || cell.rowSpan > 1
				const curRow = grid[rowIndex] ?? []
				const nextEmptyCellIndex = curRow.findIndex((cell) => !cell)
				const idxStart = nextEmptyCellIndex === -1 ? curRow.length : nextEmptyCellIndex

				for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
					grid[r] = grid[r] ?? []
					for (let c = idxStart; c < idxStart + colSpan; c++) {
						cell.colIndex = cell.colIndex > -1 ? cell.colIndex : c
						grid[r][c] = cell
					}
				}
			}

			for (let i = 0; i < table.html.length; i++) {
				const skipIndex = skipIndexMap.get(i) ?? null
				if (skipIndex) {
					cellHTML += table.html.substring(i, skipIndex + 1)
					i = skipIndex
					continue
				}

				const prev5Chars = table.html.substring(i - 4, i + 1).toLowerCase()
				const next3Chars = table.html.substring(i, i + 3).toLowerCase()

				const isCellAttsStart = ['<td', '<th'].includes(next3Chars)

				const isSelfEnclosed = isInCellAtts && table.html[i - 1] === '/' && table.html[i] === '>'
				const isCellAttsEnd = (isInCell && table.html[i] === '>') || isSelfEnclosed

				const isCellEnd = ['</td>', '</th>'].includes(prev5Chars)

				const isRowStart = next3Chars === '<tr'

				if (isRowStart) {
					rowIndex++
					grid[rowIndex] = grid[rowIndex] ?? []
				}

				if (isCellAttsStart) {
					tableCellIndex++
					isInCell = true
					isInCellAtts = true
				}

				if (isInCellAtts) {
					cellAtts += table.html[i]
				}

				if (isInCell) {
					cellHTML += table.html[i]
				}

				if (isCellAttsEnd) {
					isInCellAtts = false
				}

				if (isCellEnd || isSelfEnclosed) {
					isInCell = false
					isInCellAtts = false
					createCell(cellHTML, cellAtts)
					cellHTML = ''
					cellAtts = ''
				}
			}

			table.rows = grid
		})
	}

	private addMissingNameCol(tables: TableHTMLData[]) {
		for (const table of tables) {
			const bodyIndex = table.rows.findIndex((row) => row.some((col) => !col.isHeaderRowCell))

			// get the first column index that has a value
			let firstPopulatedColIndex = Infinity
			for (let i = bodyIndex; i < table.rows.length; i++) {
				const row = table.rows[i]
				if (!row) continue
				const populatedIndex = row.findIndex((col) => col?.valueParsed)
				const isFirstPopulatedIndex = populatedIndex > -1 && populatedIndex < firstPopulatedColIndex
				if (isFirstPopulatedIndex) firstPopulatedColIndex = populatedIndex
				if (firstPopulatedColIndex === 0) break
			}

			const shouldAddName = table.rows.some((row) => {
				const firstCol = row[firstPopulatedColIndex]
				const headerCol = firstCol?.headerCol

				// skip if the first column has a header col, or if there is no header row
				if (!firstCol || headerCol || firstCol.headerRowIndex === null) {
					return false
				}

				// if the first col is a string, assume it's a name
				return typeof firstCol?.valueParsed === 'string'
			})

			if (shouldAddName) {
				for (const row of table.rows) {
					const col = row[firstPopulatedColIndex]
					if (!col) continue

					const isEmptyRow = row.every((col) => col?.valueParsed === null)

					// for header rows, add to valueParsed, body rows, set headerCol
					if (!isEmptyRow && col.isHeaderRowCell) {
						col.valueParsed = col.valueParsed ?? '[name]'
					} else if (!col.isHeaderRowCell) {
						col.headerCol = col.headerCol ?? '[name]'
					}
				}
			}
		}
	}

	private addTableCellValues(tables: TableHTMLData[], options?: ParseOptions) {
		const getHeaderRowIndexDefault = (data: { rows: Cell[][] }) => {
			const { rows } = data
			const bodyIndex = rows.findIndex((row, r) => {
				const prevRow = rows[r - 1] ?? []

				const hadUnderlines = prevRow.some(
					(col) => col.attributes.includes('border') && col.attributes.includes('bottom'),
				)
				const hasUnderline = row.some(
					(col) => col.attributes.includes('border') && col.attributes.includes('bottom'),
				)

				if (hadUnderlines && !hasUnderline) {
					return true
				}
				return row.some((col) => {
					const valueParsed = this.parseValue(col.html, options)
					const isNumber = typeof valueParsed === 'number'
					const isYear = isNumber && valueParsed > 1900 && valueParsed < 2100
					const isCol = isNumber && !isYear

					return isCol
				})
			})

			return bodyIndex - 1
		}
		const getHeaderRowIndexCb = options?.getHeaderRowIndex ?? getHeaderRowIndexDefault
		const getHeaderRowIndex = (data: { rows: Cell[][]; table: TableHTMLData }) => {
			return Math.max(getHeaderRowIndexCb(data), -1)
		}

		const getNextCell = (row: Cell[], colIndex: number) => {
			const startingCol = row[colIndex]
			for (let i = colIndex; i < row.length; i++) {
				if (!row[i]) continue

				if (row[i].tableCellIndex !== startingCol?.tableCellIndex) {
					return row[i]
				}
			}

			return null
		}

		const completedCells = new Set<Cell>()

		for (const table of tables) {
			const headerRowIndex = getHeaderRowIndex({ rows: table.rows, table })

			for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
				const row = table.rows[rowIndex]
				if (!row) continue

				const countUniqueCells = new Set(row.map((c) => c.tableCellIndex)).size

				// skip titles in the middle of the body
				const isBodyTitleRow = rowIndex > headerRowIndex && countUniqueCells === 1 && row[0]?.colSpan > 0

				const isHeaderRow = rowIndex <= headerRowIndex

				const headerByIndex = new Map<number, string>()
				const getHeaderCol = (c: number) => {
					if (headerByIndex.has(c)) {
						return headerByIndex.get(c) ?? null
					}
					if (isHeaderRow) {
						return null
					}

					for (let r = 0; r <= headerRowIndex; r++) {
						const row = table.rows[r]
						if (!row) continue
						for (let c = 0; c < row.length; c++) {
							const col = row[c] ?? row[c - 1] ?? row[c + 1]
							if (!col) continue

							const headerCurrent = headerByIndex.get(c) ?? ''
							const value = headerCurrent.endsWith(`${col.valueParsed || ''}`)
								? headerCurrent
								: `${headerCurrent} ${col.valueParsed || ''}`.trim()

							headerByIndex.set(c, value)
						}
					}

					return headerByIndex.get(c) ?? null
				}

				for (let colIndex = 0; colIndex < row.length; colIndex++) {
					const cell = row[colIndex]

					if (completedCells.has(cell) || !cell) {
						continue
					}

					cell.headerRowIndex = headerRowIndex > -1 ? headerRowIndex : null
					cell.isBodyTitleRowCell = isBodyTitleRow
					cell.isHeaderRowCell = isHeaderRow

					// sometimes there is a rogue percent sign that is not in a column, so we need to check the next column
					const nextCell = getNextCell(row, colIndex)
					// const isMissingPercentSign =
					// 	nextCell?.html.includes('%') && this.parseValue(nextCell?.html) === null
					const isMissingParenthesis =
						nextCell?.html.includes(')') && cell.html.includes('(') && !cell.html.includes(')')

					let colValue = isMissingParenthesis ? `${cell.html.trim()})` : cell.html.trim()
					// colValue = isMissingPercentSign ? `${colValue}` : colValue
					colValue = this.parseValue(colValue, options) as string
					colValue = typeof colValue === 'string' ? colValue.replace(/\s+/g, ' ') : colValue

					// add parsed value
					cell.valueParsed = colValue
					cell.headerCol = getHeaderCol(colIndex)
					completedCells.add(cell)
				}
			}
		}
	}

	public stripHtml(str: string, options?: Omit<ParseOptions, 'stripHtml' | 'stripParenthesis'>) {
		const { tagsToExclude = [] } = options ?? {}
		let strNew = str

		if (tagsToExclude.length > 0) {
			strNew = ''
			for (let i = 0; i < str.length; i++) {
				const char = str[i]

				if (char !== '<') {
					strNew += char
					continue
				}

				const matchedTag = tagsToExclude.find(
					(tag) => str.substring(i, i + tag.length + 1).toLowerCase() === `<${tag}`,
				)

				if (!matchedTag) {
					strNew += char
					continue
				}

				const endTag = `</${matchedTag}>`
				const endTagIndex = str.indexOf(endTag, i)

				if (endTagIndex > -1) {
					i = endTagIndex + endTag.length - 1
				}
			}
		}

		return strNew.replace(/<.*?>/gm, '')
	}

	public parseValue(str: string | number | null, options?: ParseOptions) {
		if (str === null) return null
		if (typeof str === 'number') return str

		const { stripHtml = true, tagsToExclude = [], stripParenthesis = false } = options ?? {}

		const strNew = stripHtml ? this.stripHtml(str, { tagsToExclude }) : str

		let text = strNew
			.replace(/&#160;|&nbsp;|\n/g, ' ')
			.replace(/&#174;|&#9744;/g, '')
			.replace(/&#8211;|&#8212;|&#x2014;|&#151;/g, '-')
			.replace(/&#8217;|&#8220;|&#8221;|&rsquo;/g, "'")

		if (stripParenthesis) {
			text = text.replace(/\(.*?\)/g, '')
		}

		text = text
			.replace(/\s+/, ' ')
			.replace(/&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/g, ' ')
			.trim()

		if (str.replace(/&#8211;|&#8212;|&#x2014;/g, '-') === '-') return '-'
		if (text === '') return null

		let colNum = text.replace(/,|\(|\)|%/g, '').trim()
		if (colNum === '-' || colNum === '$') return null

		colNum = colNum.replace(/-|\$/g, '')

		const hasNumBeforeParenthesis = Boolean(/\d+\s*(?=\()/.test(text))
		colNum = hasNumBeforeParenthesis ? colNum.split(' ')[0]?.trim() : colNum

		if (!isNaN(Number(colNum))) {
			if (text.includes('%')) return text.replace(/[^a-zA-Z\d\s:]/g, '') === '' ? null : text
			return (text.trim().includes('(') && !hasNumBeforeParenthesis) || text.includes('-')
				? Number(colNum) * -1
				: Number(colNum)
		}

		return text
	}
}

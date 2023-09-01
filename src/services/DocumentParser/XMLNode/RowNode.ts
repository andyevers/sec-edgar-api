import { ColNode } from './ColNode'
import { TableNode } from './TableNode'
import { XMLNode } from './XMLNode'

export class RowNode extends XMLNode {
	private isHeader: boolean = false
	private isEmpty: boolean | null = null

	public getIsEmpty() {
		if (this.isEmpty !== null) return this.isEmpty
		this.isEmpty = this.toArray().filter(Boolean).length === 0

		return Boolean(this.isEmpty)
	}

	public clone(): RowNode {
		const clone = new RowNode({ attributesStr: this.getAttributesStr(), path: this.getPath() })
		clone.setText(this.getText())

		this.getChildren().forEach((child) => {
			const childNew = new ColNode({ attributesStr: child.getAttributesStr(), path: child.getPath() })
			const prevChild = clone.getChildren()[clone.getChildren().length - 1]
			childNew.setText(child.getText())
			childNew.setIndex(child.getIndex())
			prevChild?.setNextSibling(childNew)
			clone.addChild(childNew)
		})

		return clone
	}

	public setIsHeader(isHeader: boolean) {
		this.isHeader = isHeader
	}

	public getIsHeader() {
		return this.isHeader
	}

	public getChildren(): ColNode[] {
		return super.getChildren() as ColNode[]
	}

	public getParent(): TableNode {
		return super.getParent() as TableNode
	}

	public getNextSibling(): RowNode | null {
		return super.getNextSibling() as RowNode | null
	}

	public getPreviousSibling(): RowNode | null {
		return super.getPreviousSibling() as RowNode | null
	}

	/**
	 * Uses the columns in this row to build a table. Each column is also an array since cols can touch
	 * multiple other cells on the top and bottom due to colspan.
	 *
	 * ```ts
	 * const returnExample = [
	 *     [ [ColNode, ColNode], [ColNode], [ColNode, ColNode, ColNode] ]
	 *     [ [ColNode], [ColNode], [ColNode] ], // this row
	 *     [ [ColNode], [ColNode], [ColNode, ColNode] ],
	 * ]
	 * ```
	 */
	public getTableFromCols(): ColNode[][][] {
		const tableRowCols: ColNode[][][] = []
		const colIndexRanges = this.getChildren().map((col) => [col.getIndex(), col.getIndex() + col.getColSpan()])

		for (const row of this.getParent().getChildren()) {
			const rowCols: ColNode[][] = colIndexRanges.map(() => [])

			for (const col of row.getChildren()) {
				const [indexStart, indexEnd] = [col.getIndex(), col.getIndex() + col.getColSpan()]

				for (let i = 0; i < colIndexRanges.length; i++) {
					const [boundaryStart, boundaryEnd] = colIndexRanges[i]
					if (indexEnd <= boundaryStart || indexStart >= boundaryEnd) continue
					rowCols[i].push(col)
				}
			}

			tableRowCols.push(rowCols)
		}

		return tableRowCols
	}

	public toTable(parseValues: boolean = true) {
		const table = this.getTableFromCols()
		const tableTextArr: (string | number | null)[][] = []
		const headerRowIndex = this.getParent().getHeaderRowIndex() ?? -1

		for (let rowIndex = 0; rowIndex < table.length; rowIndex++) {
			const row = table[rowIndex]
			const colTextArr: (string | number | null)[] = []

			for (const colArr of row) {
				const colText = colArr.reduce((acc, col) => `${acc} ${col.getText()}`, '')

				// skip rows that are titles within the table body
				const isTitleRow =
					colArr.length === 1 &&
					colArr[0].getColSpan() >= this.getChildren().length &&
					rowIndex > headerRowIndex

				if (isTitleRow) continue

				if (!parseValues) {
					colTextArr.push(colText.trim())
					continue
				}

				// sometimes there is a rogue percent sign that is not in a column, so we need to check the next column
				const nextCol = colArr[colArr.length - 1]?.getNextSibling()
				const isMissingPercentSign = nextCol?.getText().includes('%') && nextCol.parseValue() === null
				const isMissingParenthesis =
					nextCol?.getText().includes(')') && colText.includes('(') && !colText.includes(')')

				let colTextTrimmed = isMissingParenthesis ? `${colText.trim()})` : colText.trim()
				colTextTrimmed = isMissingPercentSign ? `${colText.trim()}%` : colText.trim()
				colTextTrimmed = this.parseValue(colTextTrimmed) as string
				colTextTrimmed =
					typeof colTextTrimmed === 'string' ? colTextTrimmed.replace(/\s+/g, ' ') : colTextTrimmed

				colTextArr.push(colTextTrimmed)
			}

			tableTextArr.push(colTextArr)
		}

		if (!parseValues) return tableTextArr

		const emptyColIndexes = new Set<number>()
		cols: for (let colIndex = 0; colIndex < tableTextArr[0].length; colIndex++) {
			for (let rowIndex = 1; rowIndex < tableTextArr.length; rowIndex++) {
				if (Boolean(tableTextArr[rowIndex][colIndex]) && tableTextArr[rowIndex][colIndex] !== '%') {
					continue cols
				}
			}

			emptyColIndexes.add(colIndex)
		}

		tableTextArr.forEach((row, i) => {
			tableTextArr[i] = row.filter((_, i) => !emptyColIndexes.has(i))
		})

		const tableTextArrFiltered: (string | number | null)[][] = []

		for (let rowIndex = 0; rowIndex < tableTextArr.length; rowIndex++) {
			const row = tableTextArr[rowIndex]
			const isEmpty = !row.some(Boolean)
			// if is empty before the header or empty next to another empty row, continue
			if (isEmpty && (rowIndex < headerRowIndex || !tableTextArr[rowIndex - 1]?.some(Boolean))) {
				continue
			}

			tableTextArrFiltered.push(row)
		}

		return tableTextArr.filter((row, i) => {
			const rowPrev = tableTextArr[i - 1]
			const isEmpty = !row.some(Boolean)
			const isLast = i === tableTextArr.length - 1

			// empty rows cannot be before header, last in array, or next to another empty row
			return !(isEmpty && (i < headerRowIndex || !rowPrev?.some(Boolean) || isLast))
		})
	}

	public toArray(parseValues: boolean = true) {
		const cols: (string | null | number)[] = []
		this.getChildren().forEach((col) => {
			cols.push(parseValues ? this.parseValue(col.getText()) : col.getText())
			Array.from({ length: col.getColSpan() - 1 }).forEach(() => cols.push(null))
		})

		return cols
	}
}

import { ColNode } from './ColNode'
import { RowNode } from './RowNode'
import { XMLNode } from './XMLNode'

export class TableNode extends XMLNode {
	private title: string | null = null
	private headerRow: RowNode | null = null

	public getTitle() {
		return this.title ?? ''
	}
	public setTitle(title: string) {
		this.title = title
	}
	public getChildren(): RowNode[] {
		return super.getChildren() as RowNode[]
	}

	public removeTopChild() {
		this.removeChild(this.getChildren()[0])
	}

	public removeEmptyTopRows() {
		while (this.getChildren()[0]?.getIsEmpty()) {
			this.removeChild(this.getChildren()[0])
		}
	}

	public prependChild(node: RowNode) {
		const prevTopChild = this.getChildren()[0]

		this.getChildren().unshift(node)
		if (node.getParent() !== this) node.setParent(this)

		prevTopChild?.setPreviousSibling(node)

		const colArrTop: ColNode[] = []
		const colArrBottom: ColNode[] = []

		node.getChildren().forEach((col) => {
			colArrTop.push(col)
			Array.from({ length: col.getColSpan() - 1 }).forEach(() => colArrTop.push(col))
		})

		prevTopChild?.getChildren().forEach((col, i) => {
			colArrBottom.push(col)
			Array.from({ length: col.getColSpan() - 1 }).forEach(() => colArrBottom.push(col))
			if (!col.getTopSiblings().includes(colArrTop[i])) {
				col.addTopSibling(colArrTop[i])
			}
		})
	}

	public toArray(parseValues: boolean = true) {
		return this.getChildren().map((row) => row.toArray(parseValues))
	}

	public setHeaderRow(row: RowNode) {
		this.headerRow = row
	}

	public getHeaderRowIndex() {
		const rows = this.getChildren()

		// assume body index starts with row that has a non-bold number in it.
		const bodyIndex = rows.findIndex((row) =>
			row.getChildren().some((col) => typeof col.parseValue() === 'number' && !col.getText().includes('}}')),
		)

		const getRowData = (row: RowNode) => row.getChildren().map((col) => col.parseValue())

		// if the header row is only one value, or empty, it's likely a label in the table body, so keep moving up.
		let headerIndex = bodyIndex - 1
		while (rows[headerIndex] && getRowData(rows[headerIndex]).filter(Boolean).length <= 1 && headerIndex >= 0) {
			headerIndex--
		}

		return headerIndex >= 0 ? headerIndex : null
	}

	public mergeHeader(removeMergedChildren: boolean = true) {
		const headerRowIndex = this.getHeaderRowIndex() ?? -1
		const headerRow = this.getChildren()[headerRowIndex] ?? null
		if (!headerRow) return

		const table = headerRow.toTable(false)
		const headerRowCols = headerRow.getChildren()

		// start from the row above the header row to merge.
		for (let rowIndex = headerRowIndex - 1; rowIndex >= 0; rowIndex--) {
			const curRow = table[rowIndex]

			// go through each header column to merge with the one above.
			for (let colIndex = 0; colIndex < curRow.length; colIndex++) {
				if (table[headerRowIndex][colIndex] === null) continue

				// if prev header col is empty, get nearest to the left.
				let colIndexCur = colIndex
				while (!curRow[colIndexCur] && colIndexCur >= 0) {
					colIndexCur--
				}

				// if the value is empty, continue.
				const colValue = curRow[colIndexCur] ?? null
				if (!colValue || !this.parseValue(`${colValue}`)) continue

				headerRowCols[colIndex].setText(`${colValue} ${headerRowCols[colIndex].getText()}`.trim())
			}
		}

		if (removeMergedChildren) {
			while (this.getChildren()[0] !== headerRow && this.getChildren().length > 0) {
				this.removeTopChild()
			}
		}

		return headerRow
	}

	/**
	 * If header row is not set, this will try to find it.
	 */
	public getHeaderRow() {
		return this.headerRow ?? this.getChildren()[this.getHeaderRowIndex() ?? -1] ?? null
	}
}

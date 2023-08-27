interface XMLNodeArgs {
	path?: string
	attributesStr?: string
}

type AnyNode = XMLNode | TableNode | RowNode | ColNode | HRNode | NonTableNode | DocumentNode

export class XMLNode {
	private parent: XMLNode | null = null
	private previousSibling: XMLNode | null = null
	private nextSibling: XMLNode | null = null

	private children: XMLNode[] = []
	private text: string = ''
	private attributesStr: string = ''
	private path: string = ''

	constructor(args?: XMLNodeArgs) {
		const { attributesStr = '', path = '' } = args ?? {}
		const pathParts = path.split('.').filter((str) => !str.includes(':'))
		this.attributesStr = attributesStr
		this.path = pathParts.join('.')
	}

	public setPreviousSibling(node: XMLNode | null) {
		this.previousSibling = node
		if (node?.getNextSibling() !== this) {
			node?.setNextSibling(this)
		}
	}

	public setNextSibling(node: XMLNode | null) {
		this.nextSibling = node
		if (node?.getPreviousSibling() !== this) {
			node?.setPreviousSibling(this)
		}
	}

	public setParent(node: XMLNode | null) {
		this.parent = node
		if (!node?.getChildren().includes(this)) {
			node?.addChild(this)
		}
	}

	public getNextSibling(): AnyNode | null {
		return this.nextSibling
	}

	public getPreviousSibling(): AnyNode | null {
		return this.previousSibling
	}

	public getParent(): AnyNode | null {
		return this.parent
	}

	public getAttributes() {
		const attributesObj: Record<string, string> = {}
		this.attributesStr.match(/(\w+)=("[^"]*")/g)?.forEach((attributeStr) => {
			const [key, value] = attributeStr.split('=')
			attributesObj[key.toLowerCase()] = value.replace(/"/g, '')
		})
		return attributesObj
	}

	public getAttributesStr() {
		return this.attributesStr
	}

	public getChildren() {
		return this.children
	}

	public addChild(node: XMLNode) {
		this.children.push(node)
		if (node.getParent() !== this) {
			node.setParent(this)
		}
	}

	public getText() {
		return this.text
	}

	public setText(text: string) {
		this.text = text
	}

	public getPath() {
		return this.path
	}
}

export class TableNode extends XMLNode {
	private title: string | null = null
	private headerRow: RowNode | null = null

	public getTitle() {
		return this.title
	}
	public setTitle(title: string) {
		this.title = title
	}
	public getChildren(): RowNode[] {
		return super.getChildren() as RowNode[]
	}

	public removeTopChild() {
		this.getChildren().shift()

		const topChild = this.getChildren()[0]
		topChild?.setPreviousSibling(null)

		topChild?.getChildren().forEach((col) => {
			while (col.getTopSiblings().length > 0) {
				col.getTopSiblings().pop()
			}
		})
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

	public toArray() {
		return this.getChildren().map((row) => row.toArray())
	}

	public setHeaderRow(row: RowNode) {
		this.headerRow = row
	}

	/**
	 * If header row is not set, this will try to find it.
	 */
	public getHeaderRow() {
		if (this.headerRow) return this.headerRow
		const rows = this.getChildren()

		const isColoredRow = (row: RowNode) => {
			const firstColAttStr = row.getChildren()[0].getAttributesStr().toLowerCase().replace(/\s/g, '')
			const bgColor = firstColAttStr.split('background-color:#')[1] ?? null
			return bgColor && !bgColor.startsWith('fff') && !bgColor.startsWith('transparent')
		}

		const isStriped = rows.some((row) => isColoredRow(row)) && rows.some((row) => !isColoredRow(row))
		const indexColored = isStriped ? rows.findIndex((row) => isColoredRow(row)) : -1
		const rowBeforeColored = rows[indexColored - 2] ?? null

		if (rowBeforeColored?.getIsEmpty() === false) return rowBeforeColored

		return null
	}
}

export class RowNode extends XMLNode {
	private isHeader: boolean = false
	private isEmpty: boolean | null = null

	public getIsEmpty() {
		if (this.isEmpty !== null) return this.isEmpty
		this.isEmpty =
			this.toArray()
				.filter((x) => x !== null)
				.join('') === ''

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

	public toTable() {
		const table = this.getTableFromCols()
		const tableTextArr: string[][] = []

		for (const row of table) {
			const colTextArr: string[] = []

			for (const colArr of row) {
				const colText = colArr.reduce((acc, col) => `${acc} ${col.getText()}`, '')
				colTextArr.push(colText.trim())
			}

			tableTextArr.push(colTextArr)
		}

		return tableTextArr
	}

	public toArray() {
		const cols: (string | null)[] = []
		this.getChildren().forEach((col) => {
			cols.push(col.getText())
			Array.from({ length: col.getColSpan() - 1 }).forEach(() => cols.push(null))
		})

		return cols
	}
}

export class ColNode extends XMLNode {
	private colSpan: number | null = null
	private index: number | null = null

	private topSiblings: ColNode[] = []
	private bottomSiblings: ColNode[] = []

	public setIndex(index: number) {
		this.index = index
	}

	public getIndex() {
		return this.index ?? -1
	}

	public getParent(): RowNode {
		return super.getParent() as RowNode
	}

	public addTopSibling(node: ColNode) {
		this.topSiblings.push(node)
		if (!node.getBottomSiblings().includes(this)) {
			node.addBottomSibling(this)
		}
	}

	public addBottomSibling(node: ColNode) {
		this.bottomSiblings.push(node)
		if (!node.getTopSiblings().includes(this)) {
			node.addTopSibling(this)
		}
	}

	public getTopSiblings() {
		return this.topSiblings
	}

	public getBottomSiblings() {
		return this.bottomSiblings
	}

	public getNextSibling(): ColNode | null {
		return super.getNextSibling() as ColNode | null
	}

	public getPreviousSibling(): ColNode | null {
		return super.getPreviousSibling() as ColNode | null
	}

	public getColSpan() {
		if (this.colSpan) return this.colSpan
		const colSpan = Number(this.getAttributes().colspan ?? 1)
		this.colSpan = colSpan
		return colSpan
	}
}

export class HRNode extends XMLNode {}
export class NonTableNode extends XMLNode {}
export class DocumentNode extends XMLNode {}

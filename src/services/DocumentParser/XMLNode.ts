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
	public getChildren(): RowNode[] {
		return super.getChildren() as RowNode[]
	}

	public toArray() {
		return this.getChildren().map((row) => row.toArray())
	}
}

export class RowNode extends XMLNode {
	private cols: (string | null)[] | null = null

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

	public toArray() {
		if (this.cols) return this.cols
		const cols: (string | null)[] = []
		this.getChildren().forEach((col) => {
			cols.push(col.getText())
			Array.from({ length: col.getColSpan() - 1 }).forEach(() => cols.push(null))
		})

		this.cols = cols
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
		return this.index
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

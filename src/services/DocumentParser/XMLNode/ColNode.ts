import { RowNode } from './RowNode'
import { XMLNode } from './XMLNode'

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

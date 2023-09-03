export interface XMLNodeArgs {
	path?: string
	attributesStr?: string
}

interface GetSiblingsParams {
	dir: 'previous' | 'next'
	stopAtType?: new () => XMLNode
	includeStopAtType?: boolean
}

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

	public getSiblings(params: GetSiblingsParams) {
		const { stopAtType = XMLNode, dir, includeStopAtType = false } = params

		const isPrevious = dir === 'previous'
		const siblings: XMLNode[] = []
		let nextSibling = isPrevious ? this.getPreviousSibling() : this.getNextSibling()

		let i = 0
		while (nextSibling && !(nextSibling instanceof stopAtType)) {
			siblings.push(nextSibling)
			nextSibling = isPrevious
				? (nextSibling as XMLNode).getPreviousSibling()
				: (nextSibling as XMLNode).getNextSibling()
			i++
			if (i > 1000) throw new Error('infinite loop')
		}

		if (includeStopAtType && nextSibling instanceof stopAtType) {
			siblings.push(nextSibling)
		}

		return siblings
	}

	public extractBold(str: string = this.text) {
		const boldText =
			str
				.replace(/\n/g, '')
				.replace(/\}\}\{\{/g, ' | ')
				.replace(/&#160;|&nbsp;/g, ' ')
				.replace(/&#8211;/g, '- ')
				.match(/(?<=\{\{).*?(?=\}\})/g)
				?.join(' || ') ?? ''

		return boldText.replace(/\s+/g, ' ').trim()
	}

	public parseValue(str: string | null = this.text) {
		if (str === null) return null

		const text = str
			.replace(/&#160;|&nbsp;|\n/g, ' ')
			.replace(/&#174;/g, '')
			.replace(/&#8211;|&#8212;|&#x2014;/g, '-')
			.replace(/&#8217;|&#8220;|&#8221;|&rsquo;/g, "'")
			.replace(/(?<=\{\{).*(?=\}\})/g, (match) => `{{${match.replace(/\{\{/g, '').replace(/\}\}/g, '')}}}`)
			.replace(/\{\{+/g, '{{')
			.replace(/\}\}+/g, '}}')
			.replace(/\s+/, ' ')
			.trim()

		if (str.replace(/&#8211;|&#8212;|&#x2014;/g, '-') === '-') return '-'
		if (text === '') return null

		let colNum = text
			.replace(/,|\(|\)|\%/g, '')
			.replace(/\{\{/g, '')
			.replace(/\}\}/g, '')
			.trim()
		if (colNum === '-' || colNum === '$') return null

		colNum = colNum.replace(/\-|\$/g, '')

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

	public setPreviousSibling(node: XMLNode | null) {
		const prevPreviousSibling = this.previousSibling
		this.previousSibling = node

		if (prevPreviousSibling?.getNextSibling() === this) {
			prevPreviousSibling.setNextSibling(null)
		}

		if (node?.getNextSibling() !== this) {
			node?.setNextSibling(this)
		}
	}

	public setNextSibling(node: XMLNode | null) {
		const prevNextSibling = this.nextSibling
		this.nextSibling = node

		if (prevNextSibling?.getPreviousSibling() === this) {
			prevNextSibling.setPreviousSibling(null)
		}

		if (node?.getPreviousSibling() !== this) {
			node?.setPreviousSibling(this)
		}
	}

	public removeChild(node: XMLNode) {
		this.children.splice(this.children.indexOf(node), 1)
		if (node.getParent() === this) {
			node.setParent(null)
		}
	}

	public setParent(node: XMLNode | null) {
		const prevParent = this.parent
		this.parent = node

		if (prevParent?.getChildren().includes(this)) {
			prevParent.removeChild(this)
		}

		if (!node?.getChildren().includes(this)) {
			node?.addChild(this)
		}
	}

	public getNextSibling(): XMLNode | null {
		return this.nextSibling
	}

	public getPreviousSibling(): XMLNode | null {
		return this.previousSibling
	}

	public getParent(): XMLNode | null {
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

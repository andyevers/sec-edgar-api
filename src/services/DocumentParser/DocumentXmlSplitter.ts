export interface DocumentData {
	type: string
	fileName: string
	sequence: number
	description: string
	content: string
}

export default class DocumentXmlSplitter {
	private getLineTextAfter(documentStr: string, start: string): string {
		const textStart = documentStr.indexOf(start) + start.length
		return documentStr.substring(textStart, documentStr.indexOf('\n', textStart))
	}

	private getTextBetween(documentStr: string, start: string, end: string): string {
		const textStart = documentStr.indexOf(start) + start.length
		return documentStr.substring(textStart, documentStr.lastIndexOf(end))
	}

	public splitDocumentXml(params: { xml: string }) {
		const { xml } = params
		const documentStrings = xml.split('<DOCUMENT>')
		const headerContent = documentStrings[0]
		const documents: DocumentData[] = []

		for (let i = 1; i < documentStrings.length; i++) {
			const documentStr = documentStrings[i]
			const type = this.getLineTextAfter(documentStr, '<TYPE>')
			const sequence = this.getLineTextAfter(documentStr, '<SEQUENCE>')
			const fileName = this.getLineTextAfter(documentStr, '<FILENAME>')
			const description = this.getLineTextAfter(documentStr, '<DESCRIPTION>')
			const content = this.getTextBetween(documentStr, '<TEXT>', '</TEXT>')

			documents.push({
				description,
				fileName,
				sequence: Number(sequence),
				type,
				content,
			})
		}

		return { headerContent, documents }
	}
}

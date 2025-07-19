import type { XbrlInstance, XbrlLinkbase, XbrlSchema } from '../../../types'
import DocumentXmlSplitter, { DocumentData } from '../DocumentXmlSplitter'
import HeaderParser, { XbrlFormHeader } from './HeaderParser'
import InstanceParser from './InstanceParser'
import LinkbaseParser from './LinkbaseParser'
import SchemaParser from './SchemaParser'

export interface XbrlParseResult {
	header: XbrlFormHeader
	schema: XbrlDocument<XbrlSchema> | null
	instance: XbrlDocument<XbrlInstance> | null
	linkbasePresentation: XbrlDocument<XbrlLinkbase> | null
	linkbaseCalculation: XbrlDocument<XbrlLinkbase> | null
	linkbaseDefinition: XbrlDocument<XbrlLinkbase> | null
	linkbaseLabel: XbrlDocument<XbrlLinkbase> | null
}

interface XbrlDocument<T> {
	description: string
	fileName: string
	sequence: number
	type: string
	xbrl: T
}

interface ParseXbrlOptions {
	includeInstance?: boolean
	includeLinkbases?: boolean
	includeSchema?: boolean
}

export default class XBRLParser {
	private readonly splitter = new DocumentXmlSplitter()
	private readonly headerParser = new HeaderParser()
	private readonly linkbaseParser = new LinkbaseParser()
	private readonly instanceParser = new InstanceParser()
	private readonly schemaParser = new SchemaParser()

	private filterDocuments(documents: DocumentData[]) {
		const xmlDocs = documents.filter((doc) => doc.fileName.endsWith('.xml') || doc.fileName.endsWith('.xsd'))
		const instanceDoc =
			xmlDocs.find(
				(doc) =>
					doc.description.toLowerCase().includes('instance doc') ||
					doc.fileName.endsWith('_htm.xml') ||
					(doc.content.includes('<us-gaap') && doc.content.includes('<context')),
			) ?? null

		return {
			instanceDoc: instanceDoc,
			schemaDoc: xmlDocs.find((doc) => doc.fileName.endsWith('.xsd')) ?? null,
			linkbasePresentationDoc:
				xmlDocs.find((doc) => doc.fileName.endsWith('_pre.xml')) ??
				xmlDocs.find((doc) => doc !== instanceDoc && doc.content.includes('link:presentationLink>')) ??
				null,
			linkbaseDefinitionDoc:
				xmlDocs.find((doc) => doc.fileName.endsWith('_def.xml')) ??
				xmlDocs.find((doc) => doc !== instanceDoc && doc.content.includes('link:definitionLink>')) ??
				null,
			linkbaseCalculationDoc:
				xmlDocs.find((doc) => doc.fileName.endsWith('_cal.xml')) ??
				xmlDocs.find((doc) => doc !== instanceDoc && doc.content.includes('link:calculationLink>')) ??
				null,
			linkbaseLabelDoc:
				xmlDocs.find((doc) => doc.fileName.endsWith('_lab.xml')) ??
				xmlDocs.find((doc) => doc !== instanceDoc && doc.content.includes('link:labelLink>')) ??
				null,
		}
	}

	private createXbrlDocument<T>(doc: DocumentData | null, xbrl: T | null): XbrlDocument<T> | null {
		if (!doc) return null
		const { description, fileName, sequence, type } = doc
		return xbrl ? { fileName, description, sequence, type, xbrl } : null
	}

	public parse(xml: string, options?: ParseXbrlOptions): XbrlParseResult {
		const { includeInstance = true, includeLinkbases = true, includeSchema = true } = options ?? {}
		const documents = this.splitter.splitDocumentXml({ xml }).documents
		const {
			instanceDoc,
			linkbaseCalculationDoc,
			linkbaseDefinitionDoc,
			linkbaseLabelDoc,
			linkbasePresentationDoc,
			schemaDoc,
		} = this.filterDocuments(documents)

		const header = this.headerParser.parse(xml)
		const instance = includeInstance ? this.instanceParser.parse(instanceDoc?.content ?? '') : null
		const schema = includeSchema ? this.schemaParser.parse(schemaDoc?.content ?? '') : null

		const linkbasePresentation = includeLinkbases
			? this.linkbaseParser.parse(linkbasePresentationDoc?.content ?? '')
			: null
		const linkbaseCalculation = includeLinkbases
			? this.linkbaseParser.parse(linkbaseCalculationDoc?.content ?? '')
			: null
		const linkbaseDefinition = includeLinkbases
			? this.linkbaseParser.parse(linkbaseDefinitionDoc?.content ?? '')
			: null
		const linkbaseLabel = includeLinkbases ? this.linkbaseParser.parse(linkbaseLabelDoc?.content ?? '') : null

		return {
			header: header,
			instance: this.createXbrlDocument(instanceDoc, instance),
			schema: this.createXbrlDocument(schemaDoc, schema),
			linkbasePresentation: this.createXbrlDocument(linkbasePresentationDoc, linkbasePresentation),
			linkbaseCalculation: this.createXbrlDocument(linkbaseCalculationDoc, linkbaseCalculation),
			linkbaseDefinition: this.createXbrlDocument(linkbaseDefinitionDoc, linkbaseDefinition),
			linkbaseLabel: this.createXbrlDocument(linkbaseLabelDoc, linkbaseLabel),
		}
	}
}

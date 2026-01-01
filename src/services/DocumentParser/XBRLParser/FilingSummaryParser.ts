import XMLParser from '../XMLParser'
import utilXbrl from './util-xbrl'

interface FilingSummaryXMLRoot {
	XML: object
	FilingSummary: FilingSummaryXML
}

interface TextNode {
	'#text': string
}

interface FilingSummaryXML {
	Version: TextNode
	ReportFormat: TextNode
	ContextCount: TextNode
	ElementCount: TextNode
	EntityCount: TextNode
	FootnotesReported: TextNode
	SegmentCount: TextNode
	ScenarioCount: TextNode
	TuplesReported: TextNode
	UnitCount: TextNode
	MyReports: MyReports
	InputFiles: InputFiles
	BaseTaxonomies: BaseTaxonomies
	HasPresentationLinkbase: TextNode
	HasCalculationLinkbase: TextNode
}

interface MyReports {
	Report: Report[]
}

interface Report {
	'@_instance'?: string
	IsDefault: TextNode
	HasEmbeddedReports: TextNode
	HtmlFileName?: TextNode
	LongName: TextNode
	ReportType: TextNode
	Role?: TextNode
	ShortName: TextNode
	MenuCategory?: TextNode
	Position?: TextNode
	ParentRole?: TextNode
}

interface InputFiles {
	File: TextNode[]
}

interface BaseTaxonomies {
	BaseTaxonomy: TextNode[]
}

export interface XbrlFilingSummary {
	baseTaxonomies: string[]
	inputFiles: string[]
	contextCount: number
	elementCount: number
	entityCount: number
	footnotesReported: boolean
	hasCalculationLinkbase: boolean
	hasPresentationLinkbase: boolean
	scenarioCount: number
	segmentCount: number
	tuplesReported: boolean
	unitCount: number
	version: string
	reportFormat: string
	reports: XbrlFilingSummaryReport[]
}

export type XbrlFilingSummaryMenuCategory = 'Cover' | 'Statements' | 'Notes' | 'Policies' | 'Tables' | 'Details'
export type XbrlFilingSummaryReportType = 'Sheet' | 'Notes' | 'Book'

export interface XbrlFilingSummaryReport {
	longName: string
	shortName: string
	isDefault: boolean
	hasEmbeddedReports: boolean
	htmlFileName: string
	reportType: XbrlFilingSummaryReportType
	role: string
	menuCategory: XbrlFilingSummaryMenuCategory | null
	position: number
	parentRole: string | null
	instance: string
}

/**
 * Parse FilingSummary.xml
 */
export default class FilingSummaryParser {
	private readonly xmlParser = new XMLParser()

	private toText(node?: TextNode | string): string {
		return String(typeof node === 'object' && node !== null ? node['#text'] ?? '' : node || '')
	}

	public parse(xml: string): XbrlFilingSummary | null {
		const parts = xml ? (this.xmlParser.parse(xml) as FilingSummaryXMLRoot) : null
		const filingSummary = parts?.FilingSummary

		if (!filingSummary) return null

		const {
			BaseTaxonomies,
			ContextCount,
			ElementCount,
			EntityCount,
			FootnotesReported,
			HasCalculationLinkbase,
			HasPresentationLinkbase,
			InputFiles,
			MyReports,
			ReportFormat,
			ScenarioCount,
			SegmentCount,
			TuplesReported,
			UnitCount,
			Version,
		} = filingSummary ?? {}

		return {
			version: utilXbrl.toString(this.toText(Version)) || '',
			contextCount: utilXbrl.toNumber(this.toText(ContextCount)) || 0,
			elementCount: utilXbrl.toNumber(this.toText(ElementCount)) || 0,
			entityCount: utilXbrl.toNumber(this.toText(EntityCount)) || 0,
			footnotesReported: utilXbrl.toBoolean(this.toText(FootnotesReported)) || false,
			hasCalculationLinkbase: utilXbrl.toBoolean(this.toText(HasCalculationLinkbase)) || false,
			hasPresentationLinkbase: utilXbrl.toBoolean(this.toText(HasPresentationLinkbase)) || false,
			scenarioCount: utilXbrl.toNumber(this.toText(ScenarioCount)) || 0,
			segmentCount: utilXbrl.toNumber(this.toText(SegmentCount)) || 0,
			tuplesReported: utilXbrl.toBoolean(this.toText(TuplesReported)) || false,
			unitCount: utilXbrl.toNumber(this.toText(UnitCount)) || 0,
			reportFormat: utilXbrl.toString(this.toText(ReportFormat)) || '',
			baseTaxonomies:
				BaseTaxonomies?.BaseTaxonomy?.map((taxonomy) => utilXbrl.toString(this.toText(taxonomy))) ?? [],
			inputFiles: InputFiles?.File?.map((file) => utilXbrl.toString(this.toText(file))) ?? [],
			reports:
				MyReports?.Report?.map((report) => ({
					longName: utilXbrl.toString(this.toText(report.LongName)) || '',
					shortName: utilXbrl.toString(this.toText(report.ShortName)) || '',
					isDefault: utilXbrl.toBoolean(this.toText(report.IsDefault)) || false,
					hasEmbeddedReports: utilXbrl.toBoolean(this.toText(report.HasEmbeddedReports)) || false,
					htmlFileName: utilXbrl.toString(this.toText(report.HtmlFileName)) || '',
					reportType: utilXbrl.toString(this.toText(report.ReportType)) || '',
					role: utilXbrl.toString(this.toText(report.Role)) || '',
					menuCategory: utilXbrl.toString(this.toText(report.MenuCategory)) || null,
					position: utilXbrl.toNumber(this.toText(report.Position)) || -1,
					parentRole: utilXbrl.toString(this.toText(report.ParentRole)) || null,
					instance: utilXbrl.toString(this.toText(report['@_instance'])) || '',
				})) ?? [],
		} as XbrlFilingSummary
	}
}

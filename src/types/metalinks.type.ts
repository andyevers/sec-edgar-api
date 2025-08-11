export interface XbrlMetaLinks {
	version: string
	instance: Record<string, XbrlFilingMetaInstance>
	std_ref: Record<string, XbrlStdRef>
}

export interface XbrlStdRefFlat extends XbrlStdRef {
	key: string
}

export interface XbrlFilingMetaInstance {
	nsprefix: string
	nsuri: string
	dts: Dts
	keyStandard: number
	keyCustom: number
	axisStandard: number
	axisCustom: number
	memberStandard: number
	memberCustom: number
	hidden: Record<string, number>
	contextCount: number
	entityCount: number
	segmentCount: number
	elementCount: number
	unitCount: number
	baseTaxonomies: Record<string, number>
	report: Record<string, XbrlReport>
	tag: Record<string, Tag>
}

export interface Dts {
	inline: CalculationLink
	schema: Schema
	calculationLink: CalculationLink
	definitionLink: CalculationLink
	labelLink: CalculationLink
	presentationLink: CalculationLink
}

export interface CalculationLink {
	local: string[]
}

export interface Schema {
	local: string[]
	remote: string[]
}

export interface XbrlReport {
	role: string
	longName: string
	shortName: string
	isDefault: boolean
	groupType: GroupType
	subGroupType: SubGroupType
	menuCat: MenuCategory
	order: number
	firstAnchor: Anchor
	uniqueAnchor: Anchor | null
}

export interface Anchor {
	contextRef: string
	name: string
	unitRef: UnitRef | null
	xsiNil: string
	lang: string
	decimals: number | null
	ancestors: string[]
	reportCount: number
	baseRef: string
	first?: boolean
	unique?: boolean
}

type UnitRef = 'entity' | 'number' | 'shares' | 'usd' | 'usdPerShare'

export enum GroupType {
	Disclosure = 'disclosure',
	Document = 'document',
	Statement = 'statement',
}

type MenuCategory = 'Cover' | 'Details' | 'Notes' | 'Policies' | 'Statements' | 'Tables'
type SubGroupType = 'details' | 'parenthetical' | 'policies' | 'tables'

export interface Tag {
	xbrltype: XbrlType
	nsuri: string
	localname: string
	presentation?: string[]
	lang: Record<string, { role: TagRole }>
	auth_ref: string[]
	crdr?: CreditOrDebit
	calculation?: { [key: string]: Calculation }
}

export interface Calculation {
	parentTag: null | string
	weight: number | null
	order: number | null
	root?: boolean
}

type CreditOrDebit = 'credit' | 'debit'

export interface TagRole {
	terseLabel?: string
	label: string
	documentation?: string
	negatedTerseLabel?: string
	verboseLabel?: string
	periodStartLabel?: string
	negatedPeriodEndLabel?: string
	negatedPeriodStartLabel?: string
	periodEndLabel?: string
	totalLabel?: string
	negatedLabel?: string
	negatedTotalLabel?: string
	netLabel?: string
}

type XbrlType =
	| 'booleanItemType'
	| 'centralIndexKeyItemType'
	| 'dateItemType'
	| 'decimalItemType'
	| 'domainItemType'
	| 'durationItemType'
	| 'edgarExchangeCodeItemType'
	| 'edgarStateCountryItemType'
	| 'employerIdItemType'
	| 'enumerationSetItemType'
	| 'fileNumberItemType'
	| 'filerCategoryItemType'
	| 'fiscalPeriodItemType'
	| 'gMonthDayItemType'
	| 'gYearItemType'
	| 'integerItemType'
	| 'internationalNameItemType'
	| 'monetaryItemType'
	| 'nonemptySequenceNumberItemType'
	| 'normalizedStringItemType'
	| 'perShareItemType'
	| 'percentItemType'
	| 'pureItemType'
	| 'securityTitleItemType'
	| 'sharesItemType'
	| 'stateOrProvinceItemType'
	| 'stringItemType'
	| 'submissionTypeItemType'
	| 'textBlockItemType'
	| 'tradingSymbolItemType'
	| 'yesNoItemType'

export interface XbrlStdRef {
	role: string
	Name: string
	Section?: string
	Paragraph?: string
	SubTopic?: string
	Topic?: string
	Publisher: string
	URI?: string
	Subparagraph?: string
	Number?: string
	Subsection?: string
	Footnote?: string
	Sentence?: string
	Clause?: string
	Subclause?: string
}

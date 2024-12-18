export interface XbrlContext {
	id: string
	entity: {
		identifier: {
			value: string
			scheme: string
		}
		segment: {
			value: string
			dimension: string
		}[]
	}
	period: {
		startDate?: string
		endDate?: string
		instant?: string
	}
}

export interface XbrlUnit {
	id: string
	measure: string
}

export interface XbrlElement {
	id: string
	name: string
	contextRef: string
	continuedAt?: string
	decimals?: string
	escape?: string
	format?: string
	order?: string
	precision?: string
	scale?: string
	sign?: string
	target?: string
	text?: string
	tupleID?: string
	tupleRef?: string
	unitRef?: string
}

export interface XbrlInstance {
	contexts: XbrlContext[]
	units: XbrlUnit[]
	factElements: XbrlElement[]
}

export interface XbrlSchema {
	annotation?: XbrlSchemaAnnotation
	import?: XbrlSchemaImport[]
	element?: XbrlSchemaElement[]
	targetNamespace?: string
	elementFormDefault?: string
	attributeFormDefault?: string
	xmlns?: string
	_xmlnsProps: Record<string, string>
}

export interface XbrlLinkbaseRoleType {
	id: string
	definition: string
	usedOn: string[]
	roleURI: string
}

export interface XbrlLinkbaseItemExtended {
	type: 'extended'
	id?: string
	role?: string
	loc?: XbrlLinkbaseItemLocator[]
	calculationArc?: XbrlLinkbaseItemArc[]
	definitionArc?: XbrlLinkbaseItemArc[]
	labelArc?: XbrlLinkbaseItemArc[]
	presentationArc?: XbrlLinkbaseItemArc[]
	footnoteArc?: XbrlLinkbaseItemArc[]
	label?: XbrlLinkbaseItemResource[]
	footnote?: XbrlLinkbaseItemResource[]
}

export interface XbrlLinkbaseItemSimple {
	type: 'simple'
	href?: string
	xlink?: string
	arcrole?: string
	role?: string
	title?: string
	roleURI?: string
	arcroleURI?: string
}

export interface XbrlLinkbaseItemLocator {
	type: 'locator'
	label: string
	href: string
}

export interface XbrlLinkbaseItemArc {
	type: 'arc'
	from: string
	to: string
	order?: number
	weight?: number
	arcrole?: string
	priority?: number
	closed?: boolean
	contextElement?: string
	preferredLabel?: string
}

export interface XbrlLinkbaseItemResource {
	type: 'resource'
	id?: string
	text?: string
	label?: string
	role?: string
	xml?: string
	lang?: string
}

export interface XML {
	version?: string
	encoding?: string
}

export interface XbrlLinkbase {
	roleRef?: XbrlLinkbaseItemSimple[]
	arcroleRef?: XbrlLinkbaseItemSimple[]
	referenceLink?: XbrlLinkbaseItemExtended[]
	labelLink?: XbrlLinkbaseItemExtended[]
	presentationLink?: XbrlLinkbaseItemExtended[]
	calculationLink?: XbrlLinkbaseItemExtended[]
	definitionLink?: XbrlLinkbaseItemExtended[]
	xmlns?: string
	xsi?: string
	xlink?: string
	schemaLocation?: string
}

export interface XbrlSchemaAnnotation {
	appinfo: XbrlSchemaAppinfo
	documentation?: string
}

export interface XbrlSchemaAppinfo {
	roleType: XbrlLinkbaseRoleType[]
	linkbaseRef: XbrlLinkbaseItemSimple[]
}

export interface XbrlSchemaElement {
	name: string
	id: string
	type: string
	abstract?: boolean
	periodType?: 'instant' | 'duration'
	nillable?: boolean
	substitutionGroup?: string
	balance?: string
	typedDomainRef?: string
	domain?: string
	headUsable?: boolean
	linkrole?: string
	complexType?: object
	annotation?: object
}

export interface XbrlSchemaImport {
	namespace: string
	schemaLocation: string
}

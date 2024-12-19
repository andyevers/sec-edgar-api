import type {
	XbrlSchemaAnnotation,
	XbrlSchemaAppinfo,
	XbrlSchemaElement,
	XbrlSchemaImport,
	XbrlLinkbaseItemSimple,
	XbrlLinkbaseRoleType,
	XbrlSchema,
} from '../../../types/xbrl.type'
import XMLParser from '../XMLParser'
import utilXbrl from './util-xbrl'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default class SchemaParser {
	private readonly xmlParser = new XMLParser()
	private parseAppInfo(value: any): XbrlSchemaAppinfo {
		value = utilXbrl.toObject(value)

		const appinfo: any = {}

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as keyof XbrlSchemaAppinfo
			switch (parsedKey) {
				case 'roleType':
					appinfo.roleType = utilXbrl.toArray(value[key]).map((v: any) => this.parseRoleType(v))
					break
				case 'linkbaseRef':
					appinfo.linkbaseRef = utilXbrl.toArray(value[key]).map((v: any) => this.parseLinkbaseRef(v))
					break
			}
		}

		return appinfo
	}

	private parseRoleType(value: any): XbrlLinkbaseRoleType {
		value = utilXbrl.toObject(value)

		const roleType: any = {}
		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as keyof XbrlLinkbaseRoleType
			switch (parsedKey) {
				case 'usedOn':
					roleType[parsedKey] = utilXbrl.toArray(value[key]).map((v: any) => utilXbrl.toString(v['#text']))
					break
				default:
					roleType[parsedKey] = utilXbrl.toString(value[key])
					break
			}
		}

		return roleType
	}

	private parseLinkbaseRef(value: any): XbrlLinkbaseItemSimple {
		value = utilXbrl.toObject(value)
		const item: any = {}

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as string
			item[parsedKey] = utilXbrl.toString(value[key])
		}

		return item
	}

	private parseAnnotation(value: any): XbrlSchemaAnnotation {
		value = utilXbrl.toObject(value)
		const annotation: any = {}

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as keyof XbrlSchemaAnnotation
			switch (parsedKey) {
				case 'appinfo':
					annotation.appinfo = this.parseAppInfo(value[key])
					break
				case 'documentation':
					annotation.documentation = utilXbrl.toString(value[key])
					break
			}
		}

		return annotation
	}

	private parseElement(value: any): XbrlSchemaElement {
		value = utilXbrl.toObject(value)

		const element: any = {
			id: utilXbrl.toString(value['@_id']),
			name: utilXbrl.toString(value['@_name']),
			type: utilXbrl.toString(value['@_type']),
		}

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as keyof Required<XbrlSchemaElement>
			switch (utilXbrl.parseKey(key)) {
				case 'abstract':
				case 'nillable':
				case 'headUsable':
					element[parsedKey] = utilXbrl.toBoolean(value[key]) as any
					break
				case 'complexType':
				case 'annotation':
					element[parsedKey] = utilXbrl.toObject(value[key])
					break
				default:
					element[parsedKey] = utilXbrl.toString(value[key])
					break
			}
		}

		return element
	}

	private parseImport(value: any): XbrlSchemaImport {
		value = utilXbrl.toObject(value)
		return {
			namespace: utilXbrl.toString(value['@_namespace']),
			schemaLocation: utilXbrl.toString(value['@_schemaLocation']),
		}
	}

	public parse(xml: any) {
		const xbrl = utilXbrl.extractXbrlObject(this.xmlParser.parse(xml))

		let schemaRaw: any = null
		for (const key in xbrl) {
			if (utilXbrl.parseKey(key) !== 'schema') continue
			schemaRaw = xbrl[key]
			break
		}
		const value = schemaRaw === null ? xbrl : schemaRaw

		const schema: XbrlSchema = {
			xmlns: utilXbrl.toString(value['@_xmlns']),
			_xmlnsProps: {},
		}

		for (const key in value) {
			const parsedKey = utilXbrl.parseKey(key) as keyof Omit<XbrlSchema, '_xmlnsProps'>
			switch (parsedKey) {
				case 'annotation':
					schema.annotation = this.parseAnnotation(value[key])
					break
				case 'element':
					schema.element = utilXbrl.toArray(value[key]).map((v: any) => this.parseElement(v))
					break
				case 'import':
					schema.import = utilXbrl.toArray(value[key]).map((v: any) => this.parseImport(v))
					break
				default:
					if (key.startsWith('@_xmlns:')) {
						schema._xmlnsProps[parsedKey] = utilXbrl.toString(value[key])
					} else {
						schema[parsedKey] = utilXbrl.toString(value[key])
					}
					break
			}
		}

		return schema
	}
}

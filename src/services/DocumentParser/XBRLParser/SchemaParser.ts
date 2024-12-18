import {
	XbrlSchemaAnnotation,
	XbrlSchemaAppinfo,
	XbrlSchemaElement,
	XbrlSchemaImport,
	XbrlLinkbaseItemSimple,
	XbrlLinkbaseRoleType,
	XbrlSchema,
} from '../../../types/xbrl.type'
import XMLParser from '../XMLParser'
import utilType from './util-type'

/* eslint-disable @typescript-eslint/no-explicit-any */
export default class SchemaParser {
	private readonly xmlParser = new XMLParser()
	private parseAppInfo(value: any): XbrlSchemaAppinfo {
		value = utilType.toObject(value)

		const appinfo: any = {}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as keyof XbrlSchemaAppinfo
			switch (parsedKey) {
				case 'roleType':
					appinfo.roleType = utilType.toArray(value[key]).map((v: any) => this.parseRoleType(v))
					break
				case 'linkbaseRef':
					appinfo.linkbaseRef = utilType.toArray(value[key]).map((v: any) => this.parseLinkbaseRef(v))
					break
			}
		}

		return appinfo
	}

	private parseRoleType(value: any): XbrlLinkbaseRoleType {
		value = utilType.toObject(value)

		const roleType: any = {}
		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as keyof XbrlLinkbaseRoleType
			switch (parsedKey) {
				case 'usedOn':
					roleType[parsedKey] = utilType.toArray(value[key]).map((v: any) => utilType.toString(v['#text']))
					break
				default:
					roleType[parsedKey] = utilType.toString(value[key])
					break
			}
		}

		return roleType
	}

	private parseLinkbaseRef(value: any): XbrlLinkbaseItemSimple {
		value = utilType.toObject(value)
		const item: any = {}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as string
			item[parsedKey] = utilType.toString(value[key])
		}

		return item
	}

	private parseAnnotation(value: any): XbrlSchemaAnnotation {
		value = utilType.toObject(value)
		const annotation: any = {}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as keyof XbrlSchemaAnnotation
			switch (parsedKey) {
				case 'appinfo':
					annotation.appinfo = this.parseAppInfo(value[key])
					break
				case 'documentation':
					annotation.documentation = utilType.toString(value[key])
					break
			}
		}

		return annotation
	}

	private parseElement(value: any): XbrlSchemaElement {
		value = utilType.toObject(value)

		const element: any = {
			id: utilType.toString(value['@_id']),
			name: utilType.toString(value['@_name']),
			type: utilType.toString(value['@_type']),
		}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as keyof Required<XbrlSchemaElement>
			switch (utilType.parseKey(key)) {
				case 'abstract':
				case 'nillable':
				case 'headUsable':
					element[parsedKey] = utilType.toBoolean(value[key]) as any
					break
				case 'complexType':
				case 'annotation':
					element[parsedKey] = utilType.toObject(value[key])
					break
				default:
					element[parsedKey] = utilType.toString(value[key])
					break
			}
		}

		return element
	}

	private parseImport(value: any): XbrlSchemaImport {
		value = utilType.toObject(value)
		return {
			namespace: utilType.toString(value['@_namespace']),
			schemaLocation: utilType.toString(value['@_schemaLocation']),
		}
	}

	public parse(xml: any) {
		const parsed = this.xmlParser.parse(xml) as any
		const xbrl = parsed.XBRL ?? parsed.xbrl ?? parsed

		let schemaRaw: any = null
		for (const key in xbrl) {
			if (utilType.parseKey(key) !== 'schema') continue
			schemaRaw = xbrl[key]
			break
		}
		const value = schemaRaw === null ? xbrl : schemaRaw

		const schema: XbrlSchema = {
			xmlns: utilType.toString(value['@_xmlns']),
			_xmlnsProps: {},
		}

		for (const key in value) {
			const parsedKey = utilType.parseKey(key) as keyof Omit<XbrlSchema, '_xmlnsProps'>
			switch (parsedKey) {
				case 'annotation':
					schema.annotation = this.parseAnnotation(value[key])
					break
				case 'element':
					schema.element = utilType.toArray(value[key]).map((v: any) => this.parseElement(v))
					break
				case 'import':
					schema.import = utilType.toArray(value[key]).map((v: any) => this.parseImport(v))
					break
				default:
					if (key.startsWith('@_xmlns:')) {
						schema._xmlnsProps[parsedKey] = utilType.toString(value[key])
					} else {
						schema[parsedKey] = utilType.toString(value[key])
					}
					break
			}
		}

		return schema
	}
}

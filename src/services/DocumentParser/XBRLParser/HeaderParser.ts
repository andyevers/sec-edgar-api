/* eslint-disable @typescript-eslint/no-explicit-any */
export interface XbrlFormHeader {
	filename: string
	acceptanceDatetime: string
	accessionNumber: string
	submissionType: string
	reportDate: string
	filingDate: string
	form: string
	dateAsOfChange: string
	companyName: string
	cik: number
	sic: string
	sicDescription: string
	irsNumber: string
	stateOfIncorporation: string
	fiscalYearEnd: string
	act: string
	fileNumber: string
	filmNumber: string
	businessAddress: XbrlAddress
	mailAddress: XbrlAddress
	formerCompany: XbrlFormerCompany[]
}

export interface XbrlAddress {
	street1: string
	street2: string
	city: string
	state: string
	zip: string
	phone?: string
}

export interface XbrlFormerCompany {
	name: string
	dateOfNameChange: Date
}

export default class HeaderParser {
	public parse(xml: string): XbrlFormHeader {
		const header = xml.substring(xml.indexOf('<SEC-HEADER>'), xml.indexOf('</SEC-HEADER>') + 13)
		const lines = header.split('\n').filter((line) => line.trim().length > 0)

		const indexHead = lines.findIndex((line) => line.startsWith('<SEC-HEADER>'))
		const indexAcceptanceDatetime = lines.findIndex((line) => line.startsWith('<ACCEPTANCE-DATETIME>'))

		const filename = lines[indexHead]?.split('<SEC-HEADER>')[1]?.split(':')[0]?.trim() ?? ''
		const acceptanceDatetime = lines[indexAcceptanceDatetime]?.split('<ACCEPTANCE-DATETIME>')[1]?.trim() ?? ''

		const object: Record<string, any> = {
			'ACCESSION NUMBER': '',
			'CONFORMED SUBMISSION TYPE': '',
			'PUBLIC DOCUMENT COUNT': '',
			'CONFORMED PERIOD OF REPORT': '',
			'FILED AS OF DATE': '',
			'DATE AS OF CHANGE': '',

			// filer - companyData
			'COMPANY CONFORMED NAME': '',
			'CENTRAL INDEX KEY': '',
			'STANDARD INDUSTRIAL CLASSIFICATION': '',
			'IRS NUMBER': '',
			'STATE OF INCORPORATION': '',
			'FISCAL YEAR END': '',

			// filer - filing values
			'FORM TYPE': '',
			'SEC ACT': '',
			'SEC FILE NUMBER': '',
			'FILM NUMBER': '',

			// business address:
			'BUSINESS ADDRESS': {
				'STREET 1': '',
				'STREET 2': '',
				CITY: '',
				STATE: '',
				ZIP: '',
				'BUSINESS PHONE': '',
			},
			'MAIL ADDRESS': {
				'STREET 1': '',
				'STREET 2': '',
				CITY: '',
				STATE: '',
				ZIP: '',
			},
			'FORMER COMPANY': [],
		}

		let parentKey: string | null = null
		for (let i = 0; i < lines.length; i++) {
			if (i === indexHead || i === indexAcceptanceDatetime) {
				continue
			}

			const [k, v] = lines[i].split(':')
			const key = k?.trim() ?? ''
			const value = v?.trim() ?? ''

			if (key === '') {
				parentKey = null
			}

			// key === 'FORMER NAMES' || key === 'FILER'
			if (key === 'BUSINESS ADDRESS' || key === 'MAIL ADDRESS') {
				parentKey = key
			}

			if (key === 'FORMER COMPANY') {
				object[key].push({})
				parentKey = 'FORMER COMPANY'
				continue
			}

			if (value === '' || key === '') {
				continue
			}

			if (parentKey === 'FORMER COMPANY') {
				object[parentKey][object[parentKey].length - 1][key] = value
			} else if (parentKey) {
				object[parentKey][key] = value
			} else {
				object[key] = value
			}
		}

		const toDateStr = (str: string) => {
			if (!str) return ''
			const year = str.slice(0, 4)
			const month = str.slice(4, 6)
			const day = str.slice(6, 8)
			return `${year}-${month}-${day}`
		}

		const sicIndustryAndCode = object['STANDARD INDUSTRIAL CLASSIFICATION']

		return {
			filename,
			acceptanceDatetime,
			accessionNumber: object['ACCESSION NUMBER'],
			submissionType: object['CONFORMED SUBMISSION TYPE'],
			reportDate: toDateStr(object['CONFORMED PERIOD OF REPORT']),
			filingDate: toDateStr(object['FILED AS OF DATE']),
			form: object['FORM TYPE'],
			dateAsOfChange: toDateStr(object['DATE AS OF CHANGE']),
			companyName: object['COMPANY CONFORMED NAME'],
			cik: Number(object['CENTRAL INDEX KEY']),
			sic: (sicIndustryAndCode.split('[')[1]?.split(']')[0] ?? '0').trim(),
			sicDescription: sicIndustryAndCode.split('[')[0]?.trim() ?? '',
			irsNumber: object['IRS NUMBER'],
			stateOfIncorporation: object['STATE OF INCORPORATION'],
			fiscalYearEnd: object['FISCAL YEAR END'],
			act: object['SEC ACT'],
			fileNumber: object['SEC FILE NUMBER'],
			filmNumber: object['FILM NUMBER'],
			businessAddress: {
				street1: object['BUSINESS ADDRESS']['STREET 1'],
				street2: object['BUSINESS ADDRESS']['STREET 2'],
				city: object['BUSINESS ADDRESS']['CITY'],
				state: object['BUSINESS ADDRESS']['STATE'],
				zip: object['BUSINESS ADDRESS']['ZIP'],
				phone: object['BUSINESS ADDRESS']['BUSINESS PHONE'],
			},
			mailAddress: {
				street1: object['MAIL ADDRESS']['STREET 1'],
				street2: object['MAIL ADDRESS']['STREET 2'],
				city: object['MAIL ADDRESS']['CITY'],
				state: object['MAIL ADDRESS']['STATE'],
				zip: object['MAIL ADDRESS']['ZIP'],
			},
			formerCompany: object['FORMER COMPANY'].map((data: any) => ({
				name: data['FORMER CONFORMED NAME'] ?? '',
				dateOfNameChange: toDateStr(data['DATE OF NAME CHANGE']),
			})),
		}
	}
}

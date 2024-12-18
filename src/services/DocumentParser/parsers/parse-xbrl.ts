import { FactItem, FilingListItemTranslated, FiscalPeriod, ReportRaw, XMLParams } from '../../../types'
import { XbrlContext } from '../../../types/xbrl.type'
import XBRLParser, { ParseXbrlOptions, XbrlParseResult } from '../XBRLParser/XBRLParser'

function isWithinDays(params: { dateA: string | number | Date; dateB: string | number | Date; days: number }) {
	const { dateA, dateB, days } = params
	const timeDiff = Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime())
	const daysDiff = timeDiff / (1000 * 3600 * 24)
	return daysDiff < days
}

function buildReportsFromFacts(params: {
	filing?: FilingListItemTranslated
	fiscalPeriod?: FiscalPeriod
	fiscalYear?: number
	facts: (FactItem & { decimals?: number; scale?: number })[]
	pathSeparator: string
	cik?: number
}) {
	const { filing, facts, fiscalPeriod, fiscalYear, pathSeparator, cik: cikProp } = params

	const urlParts = filing?.url.split('/') ?? []
	const cik = cikProp ?? urlParts[urlParts.indexOf('data') ?? -1]

	const reportFactValues = {
		cik: Number(cik),
		dateReport: filing?.reportDate ?? '',
		fiscalPeriod,
		fiscalYear,
	}

	const reportFocus: ReportRaw = {
		cik: Number(cik ?? reportFactValues.cik),
		dateFiled: filing?.filingDate ?? '',
		dateReport: String(filing?.reportDate ?? reportFactValues.dateReport),
		fiscalPeriod: (fiscalPeriod ?? reportFactValues.fiscalPeriod) as FiscalPeriod,
		fiscalYear: Number(fiscalYear ?? reportFactValues.fiscalYear),
		splitDate: null,
		splitRatio: null,
		url: filing?.url ?? '',
	}

	const reportByDateRange: Record<string, { startDate: string; endDate: string; [k: string]: string | number }> = {}
	const factByName = new Map<string, FactItem & { decimals?: number; scale?: number }>()
	const roundPlacesByName = new Map<string, number>()
	const scaleByName = new Map<string, number>()
	const isFocusFactByDateKey = new Map<string, boolean>()

	for (const fact of facts) {
		const dateKey = fact.start ? `${fact.start}_${fact.end}` : fact.end
		reportByDateRange[dateKey] ??= {
			startDate: fact.start ?? '',
			endDate: fact.end,
		}

		const isFocusFact =
			isFocusFactByDateKey.get(dateKey) ??
			isWithinDays({ dateA: fact.end, dateB: reportFocus.dateReport, days: 45 })

		isFocusFactByDateKey.set(dateKey, isFocusFact)

		const el = fact
		const scale = Number(el.scale ?? 0) || 0
		const decimals = Number(el.decimals ?? 0) || 0

		const suffix = fact?.segments
			?.map(({ dimension, value }) => `${dimension}${pathSeparator}${value}`)
			.join(pathSeparator)

		const nameKey = suffix ? `${fact.name}${pathSeparator}${suffix}` : fact.name

		const roundPlaces = scale + decimals

		const prevFactKey = `${nameKey}-${dateKey}`
		const prevFact = factByName.get(prevFactKey)

		const hasValue = Boolean(fact.value)
		const hadValue = Boolean(prevFact?.value)

		if (hasValue && hadValue && fact.value !== prevFact?.value) {
			const prevRounding = roundPlacesByName.get(prevFactKey)
			const prevScale = scaleByName.get(prevFactKey)
			const prevFact = factByName.get(prevFactKey)
			const prevUnit = prevFact?.unit?.split('_').pop()?.toLowerCase()
			const unit = fact.unit?.split('_').pop()?.toLowerCase()

			const shouldSkip = [
				prevUnit?.length === 3 && unit?.length === 3 && prevUnit !== unit && prevUnit === 'usd',
				(prevRounding ?? 0) < roundPlaces,
				(prevScale ?? 0) < scale,
				(prevRounding ?? 0) === roundPlaces && (prevScale ?? 0) === scale && prevUnit === unit,
			].some(Boolean)

			if (shouldSkip) continue
		}

		roundPlacesByName.set(prevFactKey, roundPlaces)
		scaleByName.set(prevFactKey, scale)
		factByName.set(prevFactKey, fact)

		reportByDateRange[dateKey][nameKey] = fact.value
		if (isFocusFact) {
			reportFocus[nameKey] = fact.value
		}
	}

	return { reportFocus, reportByDateRange, factsFiltered: Array.from(factByName.values()) }
}

export function parseXbrl(
	params: XMLParams & ParseXbrlOptions & { includeReport?: boolean },
): XbrlParseResult & { report: ReportRaw | null; facts: FactItem[] } {
	const parser = new XBRLParser()
	const { xml, includeReport = true, ...options } = params
	const response = parser.parse(xml, options)

	const { contexts = [], factElements = [] } = response.instance?.xbrl ?? {}

	const contextById = new Map<string, XbrlContext>()
	contexts.forEach((context) => contextById.set(context.id, context))

	const cik = response.header.cik
	const accessionNumber = response.header.accessionNumber
	const accessionNumberNoHyphens = accessionNumber.replace(/-/g, '')

	const facts: (FactItem & { scale?: number })[] = []
	for (const fact of factElements) {
		const context = contextById.get(fact.contextRef)

		const end = context?.period.endDate ?? context?.period.instant ?? ''
		const start = context?.period.startDate

		const factParsed: FactItem & { scale?: number; decimals?: number } = {
			cik: cik,
			end: end,
			filed: response.header.filingDate,
			name: fact.name,
			unit: fact.unitRef ?? 'pure',
			value: isNaN(Number(fact.text)) ? String(fact.text) : Number(fact.text),
			accn: accessionNumber,
			form: response.header.form,
			segments: context?.entity.segment ?? [],
			start: start,
		}

		if (factParsed.decimals) {
			factParsed.decimals = Number(fact.decimals)
		}
		if (fact.scale) {
			factParsed.scale = Number(fact.scale)
		}

		facts.push(factParsed)
	}

	const factsForBuilder = includeReport ? facts : []
	const { factsFiltered, reportFocus } = buildReportsFromFacts({
		facts: factsForBuilder,
		pathSeparator: '>',
		fiscalPeriod: factsForBuilder.find((f) => f.name === 'dei:DocumentFiscalPeriodFocus')?.value as FiscalPeriod,
		fiscalYear: Number(factsForBuilder.find((f) => f.name === 'dei:DocumentFiscalYearFocus')?.value ?? 0) as number,
		cik: response.header.cik,
		filing: {
			acceptanceDateTime: response.header.acceptanceDatetime,
			accessionNumber: accessionNumber,
			act: response.header.act,
			fileNumber: response.header.fileNumber,
			filingDate: response.header.filingDate,
			form: response.header.form,
			filmNumber: response.header.filmNumber,
			isInlineXBRL: 1,
			isXBRL: 1,
			items: '',
			primaryDocDescription: '',
			primaryDocument: '',
			reportDate: response.header.reportDate,
			size: 1,
			url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumberNoHyphens}/${accessionNumber}.txt`,
			urlPrimaryDocument: '',
		},
	})

	return {
		...response,
		facts: factsFiltered,
		report: reportFocus,
	}
}

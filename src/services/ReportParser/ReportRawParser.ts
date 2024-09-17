import { CompanyFactListData } from '../../types'
import ReportBuilder from '../ReportBuilder'

export default class ReportRawParser {
	private readonly reportBuilder = new ReportBuilder()
	public parseReports(companyFactListData: CompanyFactListData) {
		const { facts } = this.reportBuilder.createFacts(companyFactListData)

		return this.reportBuilder.buildReports({ facts })
	}
}

import Downloader, { IDownloader } from './Downloader'
import Unzipper from './Unzipper'

interface FactsDownloaderArgs {
	downloader: IDownloader
	unzipper: Unzipper
}

interface OnChunkData {
	percentComplete: number
	chunk: Buffer
	stage: 'download' | 'unzip'
}

export interface DownloadCompanyFactsDirectoryParams {
	outputDirname: string
	unzip?: boolean
	onChunk?: (data: OnChunkData) => void
	onDownloadComplete?: () => void
	onComplete?: () => void
	onError?: (err: Error) => void
}

export interface IFactsDownloader {
	downloadCompanyFactsDirectory(params: DownloadCompanyFactsDirectoryParams): Promise<boolean>
}

export default class FactsDownloader implements IFactsDownloader {
	private readonly unzipper: Unzipper
	private readonly downloader: IDownloader

	constructor(
		args: FactsDownloaderArgs = {
			downloader: new Downloader(),
			unzipper: new Unzipper(),
		},
	) {
		const { unzipper, downloader } = args
		this.unzipper = unzipper
		this.downloader = downloader
	}

	/**
	 * Downloads the companyfacts.zip file and extracts the directory containing all company
	 * reports available from sec.gov. After downloading, you can use factFileReader and reportParser
	 * to get and read reports.
	 *
	 * Note: Over 15GB of data is downloaded and extracted.
	 */
	public async downloadCompanyFactsDirectory(params: DownloadCompanyFactsDirectoryParams): Promise<boolean> {
		const { outputDirname, onChunk, onDownloadComplete, onError, onComplete, unzip = true } = params

		return new Promise(async (resolve, reject) => {
			const filename = `${outputDirname}.zip`
			try {
				// download from sec
				await this.downloader.download({
					url: 'https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip',
					filename,
					createDirIfNotExists: true,
					resolveData: false,
					headers: {
						'Accept-Encoding': 'gzip, deflate',
					},
					onError: (err) => reject(err),
					onChunk: onChunk ? (data) => onChunk?.({ ...data, stage: 'download' }) : undefined,
				})

				onDownloadComplete?.()

				if (unzip) {
					// unzip companyfacts.zip
					await this.unzipper.unzip({
						inputFilename: filename,
						outputDirname: outputDirname,
						deleteOriginal: true,
						onError: (err) => reject(err),
						onChunk: onChunk ? (data) => onChunk?.({ ...data, stage: 'unzip' }) : undefined,
					})
				}

				onComplete?.()
				resolve(true)
			} catch (e) {
				onError?.(e as Error)
				reject(e)
			}
		})
	}
}

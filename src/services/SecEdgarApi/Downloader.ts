import * as fs from 'fs'
import { WriteStream } from 'fs'
import Client, { IClient, RequestParams } from './Client'

export interface DownloadParams extends RequestParams {
	filename: string
	createDirIfNotExists?: boolean
}

export interface IDownloader {
	download(params: DownloadParams): Promise<boolean>
}

interface FileManager {
	createWriteStream(path: string): WriteStream
	existsSync(path: string): boolean
	mkdirSync(path: string): void
}

interface DownloaderArgs {
	client: IClient
	fileManager: FileManager
}

export default class Downlaoder implements IDownloader {
	private readonly client: IClient
	private readonly fileManager: FileManager

	constructor(args: DownloaderArgs = { client: new Client(), fileManager: fs }) {
		const { client, fileManager } = args
		this.client = client
		this.fileManager = fileManager
	}

	public download(params: DownloadParams): Promise<boolean> {
		const { filename, onSuccess, onError, createDirIfNotExists = false, ...rest } = params

		return new Promise(async (resolve, reject) => {
			const dir = filename.substring(0, filename.lastIndexOf('/'))
			if (dir.length > 0 && createDirIfNotExists && !this.fileManager.existsSync(dir)) {
				this.fileManager.mkdirSync(dir)
			}

			const file = this.fileManager.createWriteStream(filename)

			file.on('close', () => resolve(true))
			file.on('finish', () => file.close())
			file.on('error', (err) => {
				file.destroy()
				onError?.(err)
				reject(false)
			})

			this.client
				.request({
					onError,
					...rest,
					onResponse: (res) => {
						res.pipe(file)
						rest.onResponse?.(res)
					},
				})
				.then((res) => onSuccess?.(res))
				.catch(() => reject(false))
		})
	}
}

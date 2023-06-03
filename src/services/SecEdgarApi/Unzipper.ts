import * as fs from 'fs'
import { ReadStream } from 'fs'
import * as _unzipper from 'unzipper'
import { ParseStream } from 'unzipper'

interface IFileManager {
	createReadStream(path: string): ReadStream
	unlinkSync(path: string): void
	statSync(path: string): fs.Stats
}

interface IFileUnzipper {
	Extract(options: { path: string }): ParseStream
}

interface UnzipperArgs {
	unzipper: IFileUnzipper
	fileManager: IFileManager
}

interface OnChunkData {
	percentComplete: number
	chunk: Buffer
}

interface UnzipParams {
	inputFilename: string
	outputDirname: string
	onChunk?: (data: OnChunkData) => void
	onError?: (err: Error) => void
	deleteOriginal?: boolean
}

export interface IUnzipper {
	unzip(params: UnzipParams): Promise<any>
}

export default class Unzipper implements IUnzipper {
	private readonly fileManager: IFileManager
	private readonly unzipper: IFileUnzipper

	constructor(args: UnzipperArgs = { fileManager: fs, unzipper: _unzipper }) {
		const { fileManager, unzipper } = args
		this.fileManager = fileManager
		this.unzipper = unzipper
	}

	public unzip(params: UnzipParams) {
		const { inputFilename, outputDirname, onChunk, onError, deleteOriginal = false } = params

		return new Promise((resolve, reject) => {
			const file = this.fileManager.createReadStream(inputFilename)
			const filesize = this.fileManager.statSync(inputFilename).size
			const unzipped = this.unzipper.Extract({ path: outputDirname })

			let lengthCurrent = 0

			file.on('data', (chunk: Buffer) => {
				lengthCurrent += chunk.length
				const percentComplete = lengthCurrent / filesize
				onChunk?.({ percentComplete, chunk })
			})

			file.pipe(unzipped)
			file.on('end', () => {
				if (deleteOriginal) {
					this.fileManager.unlinkSync(inputFilename)
				}
				resolve(true)
			})
			file.on('error', (err) => {
				onError?.(err)
				reject(false)
			})
		})
	}
}

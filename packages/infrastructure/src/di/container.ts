import {
  CreateTranscriptionUseCase,
  ExportSpreadsheetUseCase,
  GetTranscriptionUseCase,
  InMemoryEventBus,
  ProcessTranscriptionUseCase,
  UpdateTranscriptionUseCase,
} from '@quickfiller/application'
import { InMemoryTranscriptionRepository } from '../persistence/in-memory-transcription.repository.js'
import { DiskFileStorage } from '../persistence/disk-file.storage.js'
import { PdfJsExtractorAdapter } from '../pdf/pdfjs-extractor.adapter.js'
import { TesseractOcrAdapter } from '../ocr/tesseract-ocr.adapter.js'
import { ExcelJsGeneratorAdapter } from '../exporters/exceljs-generator.adapter.js'
import type { AppConfig } from '../web/config.js'

export interface Container {
  createTranscription: CreateTranscriptionUseCase
  getTranscription: GetTranscriptionUseCase
  updateTranscription: UpdateTranscriptionUseCase
  processTranscription: ProcessTranscriptionUseCase
  exportSpreadsheet: ExportSpreadsheetUseCase
  eventBus: InMemoryEventBus
  repository: InMemoryTranscriptionRepository
  storage: DiskFileStorage
  ocr: TesseractOcrAdapter
  init(): Promise<void>
  close(): Promise<void>
}

/** DI manual — sem framework; fácil de trocar qualquer adapter. */
export function buildContainer(config: AppConfig): Container {
  const eventBus = new InMemoryEventBus()
  const repository = new InMemoryTranscriptionRepository()
  const storage = new DiskFileStorage()
  const pdfExtractor = new PdfJsExtractorAdapter()
  const ocr = new TesseractOcrAdapter(config.tesseractLang)
  const generator = new ExcelJsGeneratorAdapter()

  const createTranscription = new CreateTranscriptionUseCase(repository, storage, eventBus)
  const getTranscription = new GetTranscriptionUseCase(repository)
  const updateTranscription = new UpdateTranscriptionUseCase(repository)
  const processTranscription = new ProcessTranscriptionUseCase(
    repository,
    storage,
    pdfExtractor,
    ocr,
    config.ocrWorkerPoolSize,
  )
  const exportSpreadsheet = new ExportSpreadsheetUseCase(repository, generator)

  return {
    createTranscription,
    getTranscription,
    updateTranscription,
    processTranscription,
    exportSpreadsheet,
    eventBus,
    repository,
    storage,
    ocr,
    async init() {
      await storage.init()
    },
    async close() {
      await ocr.close()
    },
  }
}

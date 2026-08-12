/**
 * Entregável do desafio: gera as planilhas (xlsx, csv, json) para cada
 * PDF de exemplo em exemplos/, usando o pipeline real da aplicação.
 *
 * Uso: npm run samples
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  InMemoryTranscriptionRepository,
  DiskFileStorage,
  PdfJsExtractorAdapter,
  TesseractOcrAdapter,
  ExcelJsGeneratorAdapter,
} from '@quickfiller/infrastructure'
import {
  CreateTranscriptionUseCase,
  ExportSpreadsheetUseCase,
  ProcessTranscriptionUseCase,
} from '@quickfiller/application'
import { TranscriptionId, ExportFormat, type DocumentType } from '@quickfiller/domain'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const exemplosDir = join(root, 'exemplos')
const outputDir = join(exemplosDir, 'output')

const DOCS: { arquivo: string; tipo: DocumentType }[] = [
  { arquivo: 'cartao-ponto-1.pdf', tipo: 'cartao-ponto' },
  { arquivo: 'cartao-ponto-2.pdf', tipo: 'cartao-ponto' },
  { arquivo: 'holerite-1.pdf', tipo: 'holerite' },
  { arquivo: 'holerite-2.pdf', tipo: 'holerite' },
]

async function main() {
  await mkdir(outputDir, { recursive: true })

  const repository = new InMemoryTranscriptionRepository()
  const storage = new DiskFileStorage(join(root, 'uploads'))
  await storage.init()
  const ocr = new TesseractOcrAdapter('por')
  const pdfExtractor = new PdfJsExtractorAdapter()
  const generator = new ExcelJsGeneratorAdapter()

  const create = new CreateTranscriptionUseCase(
    repository,
    storage,
    { subscribe: () => {}, publish: () => {} },
  )
  const process = new ProcessTranscriptionUseCase(repository, storage, pdfExtractor, ocr)
  const exportSheet = new ExportSpreadsheetUseCase(repository, generator)

  for (const doc of DOCS) {
    const path = join(exemplosDir, doc.arquivo)
    let buffer: Buffer
    try {
      buffer = await readFile(path)
    } catch {
      console.log(`Aviso: ${doc.arquivo} não encontrado em exemplos/ — pulando\n`)
      continue
    }

    const id = await create.execute({ tipo: doc.tipo, arquivo: buffer, nomeArquivo: doc.arquivo })
    await process.execute(TranscriptionId.from(id.value))

    const transcription = await repository.findById(TranscriptionId.from(id.value))
    const base = doc.arquivo.replace('.pdf', '')

    for (const formato of [ExportFormat.XLSX, ExportFormat.CSV, ExportFormat.JSON]) {
      if (!transcription || transcription.status !== 'concluido') {
        console.log(
          `Falha: ${doc.arquivo} → status ${transcription?.status ?? 'ausente'}\n`,
        )
        break
      }
      const generated = await exportSheet.execute({
        id: TranscriptionId.from(id.value),
        formato,
      })
      const outPath = join(outputDir, `${base}.${formato}`)
      await writeFile(outPath, generated.buffer)
      console.log(`gerado: ${outPath} (${generated.buffer.length} bytes)\n`)
    }
  }

  await ocr.close()
}

main().catch((error) => {
  console.error('falha ao gerar planilhas:', error)
  process.exit(1)
})

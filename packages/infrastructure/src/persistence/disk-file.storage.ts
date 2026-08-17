import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import type { FileStoragePort } from '@quickfiller/domain'

/**
 * Armazena uploads em disco sob um UUID — nunca o nome original do usuário
 * (PII). Arquivos são removidos pelo cleanup service após o período de retenção.
 */
export class DiskFileStorage implements FileStoragePort {
  private readonly dir: string

  constructor(baseDir: string = join(process.cwd(), 'uploads')) {
    this.dir = resolve(baseDir)
  }

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true })
  }

  private pathFor(id: string): string {
    const filePath = resolve(this.dir, `${id}.pdf`)
    if (!filePath.startsWith(this.dir + '/') && filePath !== this.dir) {
      throw new Error('Invalid file path')
    }
    return filePath
  }

  async save(id: string, buffer: Buffer): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.pathFor(id), buffer, { flag: 'wx' })
  }

  async read(id: string): Promise<Buffer> {
    return readFile(this.pathFor(id))
  }

  async delete(id: string): Promise<void> {
    await rm(this.pathFor(id), { force: true })
  }
}

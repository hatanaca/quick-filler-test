export interface FileStoragePort {
  save(id: string, buffer: Buffer): Promise<void>
  read(id: string): Promise<Buffer>
  delete(id: string): Promise<void>
}

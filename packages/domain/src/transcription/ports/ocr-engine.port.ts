export interface OcrEnginePort {
  recognize(imageBuffer: Buffer): Promise<string>
}

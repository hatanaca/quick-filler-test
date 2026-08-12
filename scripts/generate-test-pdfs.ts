/**
 * Gera PDFs de exemplo para desenvolvimento/testes.
 * Os PDFs reais do desafio não estão no repositório público;
 * estes reproduzem os layouts (cartão de ponto e holerite com texto).
 */
import PDFDocument from 'pdfkit'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'pdfs')
mkdirSync(outDir, { recursive: true })

function makePdf(lines: string[], filename: string): void {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  doc.on('data', (c) => chunks.push(c))
  doc.on('end', () => {
    writeFileSync(join(outDir, filename), Buffer.concat(chunks))
    console.log(`gerado: ${filename}\n`)
  })
  for (const line of lines) doc.text(line)
  doc.end()
}

// Cartão de ponto: uma linha por dia com batidas em pares
makePdf(
  [
    'CARTÃO DE PONTO',
    'Funcionário: João da Silva',
    'Matrícula: 001234',
    'Período: 05/2019',
    'DIA     ENTRADA  SAÍDA   ENTRADA  SAÍDA',
    '21/05/2019  08:25  12:00  13:05  18:25',
    '22/05/2019  08:20  12:10  13:00  18:30',
    '23/05/2019  08:30  12:00  13:10  18:20',
    '24/05/2019  08:15  12:05  13:00  18:15',
    '25/05/2019',
  ],
  'cartao-ponto-teste.pdf',
)

// Holerite: tabela de verbas + seção de bases separada
makePdf(
  [
    'HOLERITE',
    'Competência: 05/2019',
    'Funcionário: Maria Souza',
    'Matrícula: 002345',
    '',
    'COD  DESCRIÇÃO                REF     VENCIMENTOS',
    '0010 Salário Base             220,00  2.389,77',
    '5560 Horas Extras - 50%       8,00    155,91',
    '0998 INSS                     -       262,87',
    '0999 IRRF                     -       45,10',
    '',
    'Base INSS              2.545,68',
    'Base IR                2.545,68',
    'FGTS                  203,65',
    'Total Vencimentos      2.545,68',
    'Total Descontos         307,97',
    'Valor Líquido          2.237,71',
  ],
  'holerite-teste.pdf',
)

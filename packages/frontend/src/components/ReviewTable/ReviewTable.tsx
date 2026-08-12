import { useMemo } from 'react'
import type { CartaoPontoPage, HoleritePage, Transcription } from '../../types'
import { flattenCartao, flattenHolerite, type FlatRow } from '../../utils/warnings'
import { rowStyle, WarningBadge } from '../WarningBadge'

interface ReviewTableProps {
  transcricao: Transcription
  onChange: (value: unknown) => void
}

const WARNING_HEADER = ''

/**
 * Tabela editável da transcrição, seguindo as colunas da planilha
 * do tipo correspondente, com problemas destacados nas mesmas cores.
 */
export function ReviewTable({ transcricao, onChange }: ReviewTableProps) {
  const { headers, rows } = useMemo(() => {
    const pages = transcricao.value?.pages ?? []
    if (transcricao.tipo === 'cartao-ponto') {
      const flat = flattenCartao(pages as CartaoPontoPage[])
      const maxPunches = Math.max(0, ...flat.map((r) => r.day.punches.length))
      const pairs = Math.ceil(maxPunches / 2)
      const hs = ['Data']
      for (let pair = 1; pair <= pairs; pair++) hs.push(`Entrada ${pair}`, `Saída ${pair}`)
      return { headers: hs, rows: flat }
    }
    const flat = flattenHolerite(pages as HoleritePage[])
    const labels: string[] = []
    for (const row of flat) {
      for (const field of row.page.fields) {
        if (!labels.includes(field.label)) labels.push(field.label)
      }
    }
    return { headers: ['Pág.', 'Mês', 'Ano', ...labels], rows: flat }
  }, [transcricao])

  function editRow(rowIndex: number, colIndex: number, value: string) {
    const pages = transcricao.value?.pages ?? []
    if (transcricao.tipo === 'cartao-ponto') {
      const cartaoPages = structuredClone(pages) as CartaoPontoPage[]
      const flat = flattenCartao(cartaoPages)
      const day = flat[rowIndex]?.day
      if (!day) return
      if (colIndex === 0) {
        day.date_raw = value
      } else {
        const punchIndex = colIndex - 1
        const punch = day.punches[punchIndex]
        if (punch) {
          punch.time_raw = value
          punch.time_hhmm = value
        }
      }
      onChange({ pages: cartaoPages })
      return
    }

    const holeritePages = structuredClone(pages) as HoleritePage[]
    const flat = flattenHolerite(holeritePages)
    const row = flat[rowIndex]
    if (!row) return
    if (colIndex === 1) row.page.month = value
    else if (colIndex === 2) row.page.year = value
    else {
      const label = headers[colIndex] ?? ''
      const field = row.page.fields.find((f) => f.label === label)
      if (field) field.value = value
      else {
        row.page.fields.push({ code: '', label, reference: '', value })
      }
    }
    onChange({ pages: holeritePages })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-white" style={{ backgroundColor: '#173772' }}>
            {headers.map((header) => (
              <th key={header} className="border border-gray-300 px-2 py-1.5 text-left font-bold">
                {header}
              </th>
            ))}
            <th className="border border-gray-300 px-2 py-1.5">{WARNING_HEADER}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: FlatRow, rowIndex) => (
            <tr key={rowIndex} style={rowStyle(row.warning)}>
              {row.cells.map((cell, colIndex) => (
                <td key={colIndex} className="border border-gray-300 px-2 py-1">
                  <input
                    className="w-full bg-transparent outline-none"
                    value={cell ?? ''}
                    onChange={(e) => editRow(rowIndex, colIndex, e.target.value)}
                  />
                </td>
              ))}
              <td className="border border-gray-300 px-1">
                <WarningBadge warning={row.warning} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

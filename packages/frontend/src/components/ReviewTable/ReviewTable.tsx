import { useEffect, useMemo, useState } from 'react'
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
 *
 * Mantém um draft local como fonte das edições: reconstruir o payload do
 * cache a cada keystroke perdia a edição anterior quando o PUT ainda estava
 * em voo (dois edits rápidos geravam payloads do mesmo snapshot antigo, e o
 * segundo PUT substituía o value inteiro).
 */
export function ReviewTable({ transcricao, onChange }: ReviewTableProps) {
  const [draft, setDraft] = useState(() => transcricao.value)

  // Sincroniza apenas quando o DOCUMENTO muda (novo id) — nunca quando o
  // cache é atualizado pós-PUT, senão um refetch sobrescreveria caracteres
  // digitados depois do snapshot enviado.
  useEffect(() => {
    setDraft(transcricao.value)
  }, [transcricao.id])

  const { headers, rows } = useMemo(() => {
    const pages = draft?.pages ?? []
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
  }, [draft, transcricao.tipo])

  function editRow(rowIndex: number, colIndex: number, value: string) {
    const pages = draft?.pages ?? []
    if (transcricao.tipo === 'cartao-ponto') {
      // Normaliza "8:25" → "08:25" (mesma regra do extrator): sem isso o PUT
      // rejeitava time_hhmm fora do formato HH:MM estrito.
      if (colIndex > 0 && /^\d{1,2}:\d{2}$/.test(value)) {
        const [hour, minute] = value.split(':')
        value = `${(hour ?? '').padStart(2, '0')}:${minute}`
      }
      const cartaoPages = pages as CartaoPontoPage[]
      // localiza o dia correspondente à linha (rowIndex é o índice entre todos os dias)
      let remaining = rowIndex
      let pageIndex = -1
      let dayIndex = -1
      for (let i = 0; i < cartaoPages.length; i++) {
        const days = cartaoPages[i]?.days ?? []
        if (remaining < days.length) {
          pageIndex = i
          dayIndex = remaining
          break
        }
        remaining -= days.length
      }
      if (pageIndex < 0 || dayIndex < 0) return
      const day = cartaoPages[pageIndex]?.days[dayIndex]
      if (!day) return

      const nextPages = cartaoPages.map((page, i) => {
        if (i !== pageIndex) return page
        const nextDays = page.days.map((d, di) => {
          if (di !== dayIndex) return d
          if (colIndex === 0) return { ...d, date_raw: value }
          if (!value) return d
          const punchIndex = colIndex - 1
          const punch = d.punches[punchIndex]
          // Batida faltante (ex.: dia com 3 batidas, warning "ímpares") pode
          // ser adicionada — mas só a PRÓXIMA da sequência: preencher uma
          // coluna mais à frente criaria array esparso (vira null no JSON e
          // quebra o PUT no backend).
          if (!punch && punchIndex !== d.punches.length) return d
          if (!punch) {
            const nextPunches = [...d.punches]
            nextPunches[punchIndex] = {
              kind: punchIndex % 2 === 0 ? 'IN' : 'OUT',
              time_raw: value,
              time_hhmm: value,
            }
            return { ...d, punches: nextPunches }
          }
          return {
            ...d,
            punches: d.punches.map((p, pi) =>
              pi === punchIndex ? { ...p, time_raw: value, time_hhmm: value } : p,
            ),
          }
        })
        return { ...page, days: nextDays }
      })
      const next = { pages: nextPages }
      setDraft(next)
      onChange(next)
      return
    }

    const holeritePages = pages as HoleritePage[]
    const page = holeritePages[rowIndex]
    if (!page) return
    // coluna 0 = número da página: não é editável e, se fosse, criaria um
    // field fantasma com label "Pág." persistido via PUT
    if (colIndex === 0) return
    const nextPage: HoleritePage =
      colIndex === 1
        ? { ...page, month: value }
        : colIndex === 2
          ? { ...page, year: value }
          : (() => {
              const label = headers[colIndex] ?? ''
              // Último field com o label — mesmo critério de exibição/exportação
              // (Map no backend e no flattenHolerite vence com a última ocorrência).
              const field = [...page.fields].reverse().find((f) => f.label === label)
              return field
                ? {
                    ...page,
                    fields: page.fields.map((f) => (f === field ? { ...f, value } : f)),
                  }
                : {
                    ...page,
                    fields: [...page.fields, { code: '', label, reference: '', value }],
                  }
            })()
    const nextPages = holeritePages.map((p, i) => (i === rowIndex ? nextPage : p))
    const next = { pages: nextPages }
    setDraft(next)
    onChange(next)
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
                    // holerite: coluna 0 (número da página) é read-only
                    readOnly={transcricao.tipo === 'holerite' && colIndex === 0}
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

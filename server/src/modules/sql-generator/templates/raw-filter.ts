import { renderWhere } from '../sql-utils.js'
import type { ParsedQuery } from '../types.js'

export function renderRawFilter(parsed: ParsedQuery): string {
  return [
    '*',
    '| SELECT *',
    'FROM log',
    renderWhere(parsed.filters),
    `LIMIT ${parsed.limit ?? 1000}`
  ].filter(Boolean).join('\n')
}

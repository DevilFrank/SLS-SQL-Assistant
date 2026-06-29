import { renderWhere } from '../sql-utils.js'
import type { ParsedQuery } from '../types.js'

export function renderGroupCount(parsed: ParsedQuery): string {
  const groupBy = parsed.groupBy ?? []
  const where = renderWhere(parsed.filters)

  if (groupBy.includes('type') && groupBy.includes('trackType')) {
    return [
      '*',
      '| SELECT',
      '    count(*) AS cnt,',
      '    (type, trackType) AS cc',
      'FROM log',
      where,
      'GROUP BY cc',
      'ORDER BY cnt DESC'
    ].filter(Boolean).join('\n')
  }

  const selectFields = groupBy.map((field) => `    ${field},`)

  return [
    '*',
    '| SELECT',
    ...selectFields,
    '    count(*) AS cnt',
    'FROM log',
    where,
    `GROUP BY ${groupBy.join(', ')}`,
    'ORDER BY cnt DESC'
  ].filter(Boolean).join('\n')
}

import { slsDialect } from '../sls-dialect.js'
import { renderWhere } from '../sql-utils.js'
import type { ParsedQuery } from '../types.js'

export function renderDataJsonGroupCount(parsed: ParsedQuery): string {
  const jsonField = parsed.dataJsonField

  if (!jsonField) {
    throw new Error('data_json_group_count requires dataJsonField')
  }

  const expression = slsDialect.jsonExtractScalar('data', jsonField)

  return [
    '*',
    '| SELECT',
    `    ${expression} AS ${jsonField},`,
    '    count(*) AS cnt',
    'FROM log',
    renderWhere(parsed.filters),
    `GROUP BY ${expression}`,
    'ORDER BY cnt DESC'
  ].filter(Boolean).join('\n')
}

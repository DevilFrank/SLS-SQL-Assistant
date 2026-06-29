import { eventCondition, renderWhere } from '../sql-utils.js'
import type { ParsedQuery } from '../types.js'

export function renderMissingEvent(parsed: ParsedQuery): string {
  const mustHave = parsed.mustHave?.[0]
  const mustNotHave = parsed.mustNotHave?.[0]

  if (!mustHave || !mustNotHave) {
    throw new Error('missing_event requires mustHave and mustNotHave')
  }

  return [
    '*',
    '| SELECT',
    '    trackId,',
    '    count(*) AS total_count',
    'FROM log',
    renderWhere(parsed.filters),
    'GROUP BY trackId',
    'HAVING',
    `    SUM(CASE WHEN ${eventCondition(mustHave.type, mustHave.trackType)} THEN 1 ELSE 0 END) > 0`,
    '    AND',
    `    SUM(CASE WHEN ${eventCondition(mustNotHave.type, mustNotHave.trackType)} THEN 1 ELSE 0 END) = 0`,
    'ORDER BY total_count DESC',
    `LIMIT ${parsed.limit ?? 100000}`
  ].filter(Boolean).join('\n')
}

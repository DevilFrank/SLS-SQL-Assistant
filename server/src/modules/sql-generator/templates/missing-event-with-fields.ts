import { eventAlias, eventCondition, renderWhere } from '../sql-utils.js'
import type { FieldFromEvent, ParsedQuery } from '../types.js'

export function renderMissingEventWithFields(parsed: ParsedQuery): string {
  const mustHave = parsed.mustHave?.[0]
  const mustNotHave = parsed.mustNotHave?.[0]

  if (!mustHave || !mustNotHave) {
    throw new Error('missing_event_with_fields requires mustHave and mustNotHave')
  }

  const returnFields = parsed.returnFields ?? []
  const selectBlocks = returnFields.map((field, index) => renderEventField(field, index < returnFields.length - 1))

  return [
    '*',
    '| SELECT',
    '    trackId,',
    ...selectBlocks,
    'FROM log',
    renderWhere(parsed.filters),
    'GROUP BY trackId',
    'HAVING',
    `    SUM(CASE WHEN ${eventCondition(mustHave.type, mustHave.trackType)} THEN 1 ELSE 0 END) > 0`,
    '    AND',
    `    SUM(CASE WHEN ${eventCondition(mustNotHave.type, mustNotHave.trackType)} THEN 1 ELSE 0 END) = 0`,
    `LIMIT ${parsed.limit ?? 100000}`
  ].filter(Boolean).join('\n')
}

function renderEventField(field: FieldFromEvent, trailingComma: boolean): string {
  const aggregate = field.aggregate ?? 'arbitrary'
  const alias = field.alias ?? eventAlias(field.field, field.event.type, field.event.trackType)
  const suffix = trailingComma ? ',' : ''

  return [
    `    ${aggregate}(`,
    '      CASE',
    `        WHEN ${eventCondition(field.event.type, field.event.trackType)} THEN ${field.field}`,
    '        ELSE NULL',
    '      END',
    `    ) AS ${alias}${suffix}`
  ].join('\n')
}

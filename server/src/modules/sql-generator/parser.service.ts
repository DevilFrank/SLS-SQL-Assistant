import { knownFields } from './field-config.js'
import { parseWithDeepSeek } from './deepseek.service.js'
import type { EventKey, FieldFromEvent, FilterCondition, GenerateOptions, ParsedQuery } from './types.js'

const urlPattern = /https?:\/\/[^\s，,。；;、]+/i
const eventPattern = /(\d+)\s*-\s*(\d+)/g

const numberFields = ['step', 'type', 'trackType', 'code'] as const
const stringFields = [
  'requestId',
  'ip',
  'cid',
  'packageName',
  'sdkVer',
  'gid',
  'model',
  'brand',
  'os',
  'osv',
  'ua',
  'trackId',
  'taskId',
  'action',
  'actionValue',
  'path',
  'keyWord'
] as const

export async function parseNaturalLanguage(input: string, options: GenerateOptions = {}): Promise<ParsedQuery> {
  if (options.parserMode === 'deepseek') {
    return parseWithDeepSeek(input, options, parseNaturalLanguageByRules(input, options))
  }

  return parseNaturalLanguageByRules(input, options)
}

export function parseNaturalLanguageByRules(input: string, options: GenerateOptions = {}): ParsedQuery {
  const normalized = input.trim()
  const filters = parseFilters(normalized, options)
  const groupBy = parseGroupBy(normalized)
  const dataJsonField = parseDataJsonGroupField(normalized)
  const eventPair = parseMissingEvent(normalized)
  const returnFields = parseReturnFields(normalized)

  let intent: ParsedQuery['intent']

  if (eventPair && returnFields.length > 0) {
    intent = 'missing_event_with_fields'
  } else if (eventPair) {
    intent = 'missing_event'
  } else if (dataJsonField) {
    intent = 'data_json_group_count'
  } else if (groupBy.length > 0) {
    intent = 'group_count'
  } else {
    intent = 'raw_filter'
  }

  const parsed: ParsedQuery = {
    intent,
    filters,
    metrics: [{ type: 'count', alias: 'cnt' }],
    orderBy: [{ field: 'cnt', direction: 'desc' }],
    limit: null
  }

  if (groupBy.length > 0) {
    parsed.groupBy = groupBy
  }

  if (dataJsonField) {
    parsed.dataJsonField = dataJsonField
    parsed.groupBy = [dataJsonField]
  }

  if (eventPair) {
    parsed.mustHave = [eventPair.mustHave]
    parsed.mustNotHave = [eventPair.mustNotHave]
    parsed.limit = 100000
  }

  if (returnFields.length > 0) {
    parsed.returnFields = returnFields
  }

  if (intent === 'raw_filter') {
    parsed.limit = options.defaultLimit ?? 1000
  }

  return parsed
}

function parseFilters(input: string, options: GenerateOptions): FilterCondition[] {
  const filters: FilterCondition[] = []
  const url = input.match(urlPattern)?.[0]

  if (url) {
    filters.push({
      field: 'su',
      operator: options.suMatchMode === '=' ? '=' : 'like',
      value: url
    })
  }

  for (const field of numberFields) {
    const value = matchFieldValue(input, field, '(\\d+)')
    if (value !== null) {
      filters.push({ field, operator: '=', value: Number(value) })
    }
  }

  for (const field of stringFields) {
    const value = matchFieldValue(input, field, '([^，,。；;\\s]+)')
    if (value !== null) {
      filters.push({ field, operator: '=', value })
    }
  }

  return dedupeFilters(filters)
}

function matchFieldValue(input: string, field: string, valuePattern: string): string | null {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escapedField}\\s*(?:是|为|=|等于|包含)\\s*${valuePattern}`, 'i')
  return input.match(pattern)?.[1] ?? null
}

function dedupeFilters(filters: FilterCondition[]): FilterCondition[] {
  const seen = new Set<string>()
  return filters.filter((filter) => {
    const key = `${filter.field}:${filter.operator}:${filter.value}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function parseGroupBy(input: string): string[] {
  const match = input.match(/(?:按|根据)\s*([^，,。；;]+?)\s*(?:分组|聚合|统计)/)
  if (!match) {
    return []
  }

  const raw = match[1]
    .replace(/字段/g, '')
    .replace(/和/g, ',')
    .replace(/与/g, ',')
    .replace(/及/g, ',')
    .replace(/、/g, ',')

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => item !== 'data 中')
    .filter((item) => knownFields.has(item))
}

function parseDataJsonGroupField(input: string): string | undefined {
  const match = input.match(/data\s*中\s*([A-Za-z_][A-Za-z0-9_]*)\s*字段/)
  if (!match) {
    return undefined
  }

  return match[1]
}

function parseMissingEvent(input: string): { mustHave: EventKey; mustNotHave: EventKey } | undefined {
  const match = input.match(/有\s*(\d+)\s*-\s*(\d+).*?(?:没有|无)\s*(\d+)\s*-\s*(\d+)/)
  if (!match) {
    return undefined
  }

  return {
    mustHave: { type: Number(match[1]), trackType: Number(match[2]) },
    mustNotHave: { type: Number(match[3]), trackType: Number(match[4]) }
  }
}

function parseReturnFields(input: string): FieldFromEvent[] {
  const returnIndex = input.search(/返回|展示/)
  if (returnIndex < 0) {
    return []
  }

  const returnText = input.slice(returnIndex)
  const aggregate: FieldFromEvent['aggregate'] = /全部|多个|列表|list/i.test(returnText) ? 'array_agg' : 'arbitrary'
  const fields: FieldFromEvent[] = []
  const regex = /(\d+)\s*-\s*(\d+)\s*的\s*([A-Za-z_][A-Za-z0-9_]*)/g

  for (const match of returnText.matchAll(regex)) {
    const field = match[3]
    if (!knownFields.has(field)) {
      continue
    }

    const type = Number(match[1])
    const trackType = Number(match[2])
    fields.push({
      event: { type, trackType },
      field,
      alias: field === 'actionValue' ? 'actionValue' : `${field}_${type}_${trackType}`,
      aggregate
    })
  }

  return fields
}

export function parseEventKeys(input: string): EventKey[] {
  return [...input.matchAll(eventPattern)].map((match) => ({
    type: Number(match[1]),
    trackType: Number(match[2])
  }))
}

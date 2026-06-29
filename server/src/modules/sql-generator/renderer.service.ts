import { fieldDescriptionMap } from './field-config.js'
import { renderDataJsonGroupCount } from './templates/data-json-group-count.js'
import { renderGroupCount } from './templates/group-count.js'
import { renderMissingEventWithFields } from './templates/missing-event-with-fields.js'
import { renderMissingEvent } from './templates/missing-event.js'
import { renderRawFilter } from './templates/raw-filter.js'
import type { ParsedQuery } from './types.js'

export function renderSql(parsed: ParsedQuery): string {
  switch (parsed.intent) {
    case 'group_count':
      return renderGroupCount(parsed)
    case 'raw_filter':
      return renderRawFilter(parsed)
    case 'missing_event':
      return renderMissingEvent(parsed)
    case 'missing_event_with_fields':
      return renderMissingEventWithFields(parsed)
    case 'data_json_group_count':
      return renderDataJsonGroupCount(parsed)
    default:
      throw new Error('Unsupported query intent')
  }
}

export function buildExplanation(parsed: ParsedQuery): string {
  const hasSu = parsed.filters.some((filter) => filter.field === 'su')

  if (parsed.intent === 'group_count') {
    if (parsed.groupBy?.includes('type') && parsed.groupBy.includes('trackType')) {
      return `${hasSu ? '该 SQL 查询 su 包含指定 URL 的日志，并' : '该 SQL '}按照 type、trackType 的组合分组统计数量。`
    }

    return `${hasSu ? '该 SQL 查询 su 包含指定 URL 的日志，并' : '该 SQL '}按照 ${parsed.groupBy?.join('、')} 分组统计数量。`
  }

  if (parsed.intent === 'raw_filter') {
    return '该 SQL 按指定条件过滤日志明细，并默认返回最多 1000 条。'
  }

  if (parsed.intent === 'missing_event') {
    return '该 SQL 按 trackId 聚合，筛选同一链路下存在指定事件且不存在另一个事件的日志。'
  }

  if (parsed.intent === 'missing_event_with_fields') {
    return '该 SQL 按 trackId 聚合，筛选有 A 无 B 的链路，并从指定事件中提取字段。'
  }

  return `该 SQL 提取 data 中的 ${parsed.dataJsonField} 字段，并按该 JSON 字段统计数量。`
}

export function buildFieldDescriptions(parsed: ParsedQuery): string[] {
  const fields = new Set<string>()

  parsed.filters.forEach((filter) => fields.add(filter.field))
  parsed.groupBy?.forEach((field) => {
    if (fieldDescriptionMap[field]) fields.add(field)
  })
  parsed.returnFields?.forEach((field) => fields.add(field.field))

  if (parsed.mustHave?.length || parsed.mustNotHave?.length) {
    fields.add('trackId')
    fields.add('type')
    fields.add('trackType')
  }

  if (parsed.dataJsonField) {
    fields.add('data')
  }

  const descriptions = [...fields].map((field) => {
    const item = fieldDescriptionMap[field]
    if (!item) {
      return ''
    }

    if (field === 'su') {
      return `${field}：${item.description}，默认使用 LIKE 匹配。`
    }

    if (item.description.includes('SLS 查询中按')) {
      return `${field}：${item.description}。`
    }

    return `${field}：${item.description}，SLS 查询中按 ${item.type} 处理。`
  }).filter(Boolean)

  if (parsed.metrics?.some((metric) => metric.alias === 'cnt')) {
    descriptions.push('cnt：当前分组下的日志数量。')
  }

  if (parsed.intent === 'missing_event') {
    descriptions.push('total_count：当前 trackId 下的日志总数。')
  }

  if (parsed.groupBy?.includes('type') && parsed.groupBy.includes('trackType')) {
    descriptions.push('cc：type 和 trackType 的组合，例如 (6, 1)、(7, 1)。')
  }

  return descriptions
}

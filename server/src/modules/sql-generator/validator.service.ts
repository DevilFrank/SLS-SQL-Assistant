import { fieldTypeMap, knownFields } from './field-config.js'
import type { ParsedQuery } from './types.js'

export interface ValidationResult {
  valid: boolean
  message?: string
  warnings: string[]
}

export function validateParsedQuery(parsed: ParsedQuery): ValidationResult {
  const warnings: string[] = []

  for (const filter of parsed.filters) {
    if (!knownFields.has(filter.field)) {
      return { valid: false, message: `暂不支持字段 ${filter.field}。`, warnings }
    }

    if (fieldTypeMap[filter.field] === 'number' && typeof filter.value !== 'number') {
      return { valid: false, message: `${filter.field} 是 number 类型，过滤值必须是数字。`, warnings }
    }
  }

  for (const field of parsed.groupBy ?? []) {
    if (parsed.intent === 'data_json_group_count') {
      continue
    }

    if (!knownFields.has(field)) {
      return { valid: false, message: `暂不支持按 ${field} 分组。`, warnings }
    }
  }

  for (const returnField of parsed.returnFields ?? []) {
    if (!knownFields.has(returnField.field)) {
      return { valid: false, message: `暂不支持返回字段 ${returnField.field}。`, warnings }
    }
  }

  if (parsed.intent === 'group_count' && (!parsed.groupBy || parsed.groupBy.length === 0)) {
    return { valid: false, message: '暂不支持该查询需求，请补充分组字段或过滤条件。', warnings }
  }

  if (parsed.intent === 'missing_event' || parsed.intent === 'missing_event_with_fields') {
    if (!parsed.mustHave?.length || !parsed.mustNotHave?.length) {
      return { valid: false, message: '请补充“有 A 没有 B”的事件类型，例如有 6-1 没有 7-1。', warnings }
    }
  }

  if (parsed.intent === 'data_json_group_count' && !parsed.dataJsonField) {
    return { valid: false, message: '请补充 data 中需要分组的 JSON 字段。', warnings }
  }

  if (parsed.filters.some((filter) => filter.field === 'su' && filter.operator === 'like')) {
    warnings.push('su 默认使用 LIKE 匹配，适合 su 中包含额外参数或路径的情况。')
  }

  if (usesNumberFields(parsed)) {
    warnings.push('type、trackType、step、code 是数值字段，SQL 中不会加引号。')
  }

  if (parsed.groupBy?.includes('type') && parsed.groupBy.includes('trackType')) {
    warnings.push('cc 表示 type 和 trackType 的组合，例如 (6, 1)、(7, 1)、(11, 5)。')
  }

  if (parsed.intent === 'data_json_group_count') {
    warnings.push('data JSON 字段提取函数来自 slsDialect，若当前 SLS 环境不支持可统一替换。')
  }

  return { valid: true, warnings }
}

function usesNumberFields(parsed: ParsedQuery): boolean {
  const numberFields = new Set(['type', 'trackType', 'step', 'code'])
  return parsed.filters.some((filter) => numberFields.has(filter.field))
    || Boolean(parsed.mustHave?.length)
    || Boolean(parsed.mustNotHave?.length)
    || Boolean(parsed.groupBy?.some((field) => numberFields.has(field)))
}

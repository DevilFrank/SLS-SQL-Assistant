import { fieldTypeMap } from './field-config.js'
import type { FilterCondition } from './types.js'

export function escapeStringLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\r?\n/g, ' ')
}

export function escapeLikeValue(value: string): string {
  return escapeStringLiteral(value)
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

export function renderValue(field: string, value: string | number, operator: string): string {
  const fieldType = fieldTypeMap[field]

  if (fieldType === 'number') {
    return String(value)
  }

  if (operator === 'like') {
    return `'%${escapeLikeValue(String(value))}%'`
  }

  return `'${escapeStringLiteral(String(value))}'`
}

export function renderWhere(filters: FilterCondition[]): string {
  if (filters.length === 0) {
    return ''
  }

  const lines = filters.map((filter, index) => {
    const clause = `${filter.field} ${filter.operator.toUpperCase()} ${renderValue(filter.field, filter.value, filter.operator)}`
    return index === 0 ? `WHERE ${clause}` : `  AND ${clause}`
  })

  return lines.join('\n')
}

export function eventCondition(type: number, trackType: number): string {
  return `type = ${type} AND trackType = ${trackType}`
}

export function eventAlias(field: string, type: number, trackType: number): string {
  if (field === 'actionValue') {
    return 'actionValue'
  }

  return `${field}_${type}_${trackType}`
}

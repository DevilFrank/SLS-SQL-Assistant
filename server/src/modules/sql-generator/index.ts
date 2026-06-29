import { parseNaturalLanguage } from './parser.service.js'
import { buildExplanation, buildFieldDescriptions, renderSql } from './renderer.service.js'
import { validateParsedQuery } from './validator.service.js'
import type { GenerateOptions, GenerateResult } from './types.js'

export async function generateSql(input: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  try {
    const parsed = await parseNaturalLanguage(input, options)
    const validation = validateParsedQuery(parsed)

    if (!validation.valid) {
      return {
        success: false,
        message: validation.message ?? '暂不支持该查询需求，请补充 su、分组字段或过滤条件。',
        warnings: validation.warnings
      }
    }

    return {
      success: true,
      data: {
        sql: renderSql(parsed),
        intent: parsed.intent,
        parsed,
        explanation: buildExplanation(parsed),
        warnings: validation.warnings,
        fieldDescriptions: buildFieldDescriptions(parsed)
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'SQL 生成失败。'
    }
  }
}

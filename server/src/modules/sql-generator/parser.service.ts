import { parseWithDeepSeek } from './deepseek.service.js'
import type { GenerateOptions, ParseResult } from './types.js'

export async function parseNaturalLanguage(input: string, options: GenerateOptions = {}): Promise<ParseResult> {
  return parseWithDeepSeek(input, options)
}

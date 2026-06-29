import OpenAI from 'openai'
import { fieldDictionary, fieldTypeMap, knownFields } from './field-config.js'
import { loadDotEnv } from './env.js'
import type {
  EventKey,
  FieldFromEvent,
  FilterCondition,
  GenerateOptions,
  OrderByDefinition,
  ParsedQuery,
  QueryIntent
} from './types.js'

interface DeepSeekChatResponse {
  choices?: Array<{
    finish_reason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'insufficient_system_resource'
    message?: {
      content?: string
      reasoning_content?: string
    }
  }>
  usage?: {
    completion_tokens?: number
    prompt_tokens?: number
    total_tokens?: number
  }
  error?: {
    message?: string
  }
}

const allowedIntents = new Set<QueryIntent>([
  'group_count',
  'raw_filter',
  'missing_event',
  'missing_event_with_fields',
  'data_json_group_count'
])

export async function parseWithDeepSeek(
  input: string,
  options: GenerateOptions,
  ruleParsed: ParsedQuery
): Promise<ParsedQuery> {
  loadDotEnv()

  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro'
  const maxTokens = Number(process.env.DEEPSEEK_MAX_TOKENS ?? 2048)
  const temperature = Number(process.env.DEEPSEEK_TEMPERATURE ?? 0)
  const topP = Number(process.env.DEEPSEEK_TOP_P ?? 1)
  const thinkingType = process.env.DEEPSEEK_THINKING === 'enabled' ? 'enabled' : 'disabled'
  const reasoningEffort = process.env.DEEPSEEK_REASONING_EFFORT ?? 'medium'

  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY，请先在 .env 中添加 DeepSeek API Key。')
  }

  const openai = new OpenAI({
    baseURL: baseUrl,
    apiKey
  })

  const requestBody: Record<string, unknown> = {
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt()
      },
      {
        role: 'user',
        content: JSON.stringify({
          input,
          options,
          ruleParsedForReference: ruleParsed
        })
      }
    ],
    model,
    thinking: { type: thinkingType },
    max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 2048,
    response_format: { type: 'json_object' },
    stop: null,
    stream: false,
    stream_options: null,
    temperature: Number.isFinite(temperature) ? temperature : 0,
    top_p: Number.isFinite(topP) ? topP : 1,
    tools: null,
    tool_choice: 'none',
    logprobs: false,
    top_logprobs: null
  }

  if (thinkingType === 'enabled') {
    requestBody.reasoning_effort = reasoningEffort
  }

  const payload = await openai.chat.completions.create(requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) as DeepSeekChatResponse

  const choice = payload.choices?.[0]
  const finishReason = choice?.finish_reason

  if (finishReason === 'length') {
    throw new Error('DeepSeek 返回内容被 max_tokens 截断，请调大 DEEPSEEK_MAX_TOKENS。')
  }

  if (finishReason === 'content_filter') {
    throw new Error('DeepSeek 返回内容被内容安全策略过滤。')
  }

  if (finishReason === 'insufficient_system_resource') {
    throw new Error('DeepSeek 当前系统推理资源不足，请稍后重试。')
  }

  const content = choice?.message?.content
  if (!content) {
    throw new Error('DeepSeek API 未返回解析结果。')
  }

  return normalizeParsedQuery(parseJsonContent(content), ruleParsed, options)
}

function buildSystemPrompt(): string {
  return [
    '你是阿里云 SLS SQL Assistant 的自然语言解析器。',
    '你只能输出 JSON，不要输出 Markdown，不要生成 SQL。',
    '必须输出一个完整 JSON object，不能输出空白字符或解释性文本。',
    '你的任务是把用户输入解析为 ParsedQuery 结构，后续系统会校验字段并用固定模板生成 SQL。',
    '支持的 intent 只有：group_count、raw_filter、missing_event、missing_event_with_fields、data_json_group_count。',
    'su 字段默认使用 like；type、trackType、step、code 必须作为 number。',
    '识别 6-1、7-1、11-5 这类事件为 { "type": 6, "trackType": 1 }。',
    '返回字段格式为 { "event": { "type": 6, "trackType": 1 }, "field": "actionValue", "alias": "actionValue", "aggregate": "arbitrary" }。',
    '如果用户要求全部、多个、列表，aggregate 使用 array_agg，否则使用 arbitrary。',
    'data 中 reason 字段分组时，intent 使用 data_json_group_count，dataJsonField 为 reason。',
    '输出 JSON 示例：{"intent":"group_count","filters":[{"field":"su","operator":"like","value":"https://example.com"}],"groupBy":["type","trackType"],"metrics":[{"type":"count","alias":"cnt"}],"orderBy":[{"field":"cnt","direction":"desc"}],"limit":null}',
    `字段字典：${JSON.stringify(fieldDictionary)}`
  ].join('\n')
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('DeepSeek 返回内容不是有效 JSON。')
    }

    return JSON.parse(jsonMatch[0])
  }
}

function normalizeParsedQuery(raw: unknown, fallback: ParsedQuery, options: GenerateOptions): ParsedQuery {
  if (!isRecord(raw)) {
    throw new Error('DeepSeek 返回 JSON 结构无效。')
  }

  const intent = allowedIntents.has(raw.intent as QueryIntent)
    ? raw.intent as QueryIntent
    : fallback.intent

  const parsed: ParsedQuery = {
    intent,
    filters: normalizeFilters(raw.filters, fallback.filters),
    metrics: [{ type: 'count', alias: 'cnt' }],
    orderBy: normalizeOrderBy(raw.orderBy),
    limit: normalizeLimit(raw.limit, intent, options)
  }

  const groupBy = normalizeStringArray(raw.groupBy)
  if (groupBy.length > 0) {
    parsed.groupBy = groupBy
  }

  const mustHave = normalizeEvents(raw.mustHave)
  if (mustHave.length > 0) {
    parsed.mustHave = mustHave
  }

  const mustNotHave = normalizeEvents(raw.mustNotHave)
  if (mustNotHave.length > 0) {
    parsed.mustNotHave = mustNotHave
  }

  const returnFields = normalizeReturnFields(raw.returnFields)
  if (returnFields.length > 0) {
    parsed.returnFields = returnFields
  }

  if (typeof raw.dataJsonField === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.dataJsonField)) {
    parsed.dataJsonField = raw.dataJsonField
    parsed.groupBy = [raw.dataJsonField]
  } else if (intent === 'data_json_group_count') {
    parsed.dataJsonField = fallback.dataJsonField
    parsed.groupBy = fallback.groupBy
  }

  return parsed
}

function normalizeFilters(raw: unknown, fallback: FilterCondition[]): FilterCondition[] {
  if (!Array.isArray(raw)) {
    return fallback
  }

  const filters = raw.flatMap((item): FilterCondition[] => {
    if (!isRecord(item) || typeof item.field !== 'string' || !knownFields.has(item.field)) {
      return []
    }

    const operator = item.operator === 'like' ? 'like' : item.operator === '=' ? '=' : undefined
    if (!operator) {
      return []
    }

    const fieldType = fieldTypeMap[item.field]
    const rawValue = item.value

    if (fieldType === 'number') {
      const value = Number(rawValue)
      return Number.isFinite(value) ? [{ field: item.field, operator, value }] : []
    }

    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      return [{ field: item.field, operator, value: String(rawValue) }]
    }

    return []
  })

  return filters.length > 0 ? filters : fallback
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .filter((item): item is string => typeof item === 'string')
    .filter((item) => knownFields.has(item) || /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
}

function normalizeEvents(raw: unknown): EventKey[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((item): EventKey[] => {
    if (!isRecord(item)) {
      return []
    }

    const type = Number(item.type)
    const trackType = Number(item.trackType)

    return Number.isFinite(type) && Number.isFinite(trackType)
      ? [{ type, trackType }]
      : []
  })
}

function normalizeReturnFields(raw: unknown): FieldFromEvent[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((item): FieldFromEvent[] => {
    if (!isRecord(item) || !isRecord(item.event) || typeof item.field !== 'string' || !knownFields.has(item.field)) {
      return []
    }

    const type = Number(item.event.type)
    const trackType = Number(item.event.trackType)

    if (!Number.isFinite(type) || !Number.isFinite(trackType)) {
      return []
    }

    const aggregate = item.aggregate === 'array_agg' ? 'array_agg' : 'arbitrary'
    const alias = typeof item.alias === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(item.alias)
      ? item.alias
      : item.field === 'actionValue' ? 'actionValue' : `${item.field}_${type}_${trackType}`

    return [{
      event: { type, trackType },
      field: item.field,
      alias,
      aggregate
    }]
  })
}

function normalizeOrderBy(raw: unknown): OrderByDefinition[] {
  if (!Array.isArray(raw)) {
    return [{ field: 'cnt', direction: 'desc' }]
  }

  const orderBy = raw.flatMap((item): OrderByDefinition[] => {
    if (!isRecord(item) || typeof item.field !== 'string') {
      return []
    }

    return [{
      field: item.field,
      direction: item.direction === 'asc' ? 'asc' : 'desc'
    }]
  })

  return orderBy.length > 0 ? orderBy : [{ field: 'cnt', direction: 'desc' }]
}

function normalizeLimit(raw: unknown, intent: QueryIntent, options: GenerateOptions): number | null {
  const value = Number(raw)

  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (intent === 'raw_filter') {
    return options.defaultLimit ?? 1000
  }

  if (intent === 'missing_event' || intent === 'missing_event_with_fields') {
    return 100000
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

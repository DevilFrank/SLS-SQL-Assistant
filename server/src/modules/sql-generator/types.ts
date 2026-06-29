export type QueryIntent =
  | 'group_count'
  | 'raw_filter'
  | 'missing_event'
  | 'missing_event_with_fields'
  | 'data_json_group_count'

export type FieldType = 'string' | 'number' | 'json'

export type FilterOperator = '=' | 'like' | '>' | '>=' | '<' | '<='

export interface FilterCondition {
  field: string
  operator: FilterOperator
  value: string | number
}

export interface EventKey {
  type: number
  trackType: number
}

export interface FieldFromEvent {
  event: EventKey
  field: string
  alias?: string
  aggregate?: 'arbitrary' | 'array_agg'
}

export interface MetricDefinition {
  type: 'count'
  alias: string
}

export interface OrderByDefinition {
  field: string
  direction: 'asc' | 'desc'
}

export interface ParsedQuery {
  intent: QueryIntent
  filters: FilterCondition[]
  groupBy?: string[]
  metrics?: MetricDefinition[]
  orderBy?: OrderByDefinition[]
  mustHave?: EventKey[]
  mustNotHave?: EventKey[]
  returnFields?: FieldFromEvent[]
  dataJsonField?: string
  limit?: number | null
}

export interface GenerateOptions {
  defaultLimit?: number
  suMatchMode?: 'like' | '='
}

export interface LlmMessageTrace {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmTrace {
  provider: 'deepseek'
  model: string
  baseUrl: string
  messages: LlmMessageTrace[]
  responseContent: string
  reasoningContent?: string
  finishReason?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface ParseResult {
  parsed: ParsedQuery
  llmTrace?: LlmTrace
}

export interface GenerateSuccess {
  success: true
  data: {
    sql: string
    intent: QueryIntent
    parsed: ParsedQuery
    explanation: string
    warnings: string[]
    fieldDescriptions: string[]
    llmTrace?: LlmTrace
  }
}

export interface GenerateFailure {
  success: false
  message: string
  warnings?: string[]
}

export type GenerateResult = GenerateSuccess | GenerateFailure

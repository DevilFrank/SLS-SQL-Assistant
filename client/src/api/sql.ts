export interface FieldDictionaryItem {
  field: string
  type: 'string' | 'number' | 'json'
  required: boolean
  description: string
  example: string
}

export interface GenerateResponse {
  success: boolean
  message?: string
  data?: {
    sql: string
    intent: string
    parsed: unknown
    explanation: string
    warnings: string[]
    fieldDescriptions: string[]
    llmTrace?: {
      provider: 'deepseek'
      model: string
      baseUrl: string
      messages: Array<{
        role: 'system' | 'user' | 'assistant'
        content: string
      }>
      responseContent: string
      reasoningContent?: string
      finishReason?: string
      usage?: {
        promptTokens?: number
        completionTokens?: number
        totalTokens?: number
      }
    }
  }
}

export async function generateSql(input: string): Promise<GenerateResponse> {
  const response = await fetch('/api/sql/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input,
      options: {
        defaultLimit: 1000,
        suMatchMode: 'like'
      }
    })
  })

  return response.json()
}

export async function fetchFields(): Promise<FieldDictionaryItem[]> {
  const response = await fetch('/api/sql/fields')
  const payload = await response.json()
  return payload.data ?? []
}

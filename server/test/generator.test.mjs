import assert from 'node:assert/strict'
import { generateSql } from '../dist/modules/sql-generator/index.js'
import { loadDotEnv } from '../dist/modules/sql-generator/env.js'

loadDotEnv()

if (!process.env.DEEPSEEK_API_KEY) {
  console.log('Skipped DeepSeek integration test: DEEPSEEK_API_KEY is not set.')
  process.exit(0)
}

const result = await generateSql('查询 su 是 https://www.fpffz.top/?channel=news01 的数据，按 type 和 trackType 分组显示')

assert.equal(result.success, true)

if (!result.success) {
  throw new Error(result.message)
}

assert.equal(result.data.intent, 'group_count')
assert.match(result.data.sql, /GROUP BY cc/)
assert.ok(result.data.llmTrace?.messages.length)
assert.equal(result.data.llmTrace?.provider, 'deepseek')

console.log('Passed DeepSeek SQL generator integration smoke test.')

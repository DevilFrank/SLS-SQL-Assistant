<template>
  <main class="page-shell">
    <section class="workspace">
      <aside class="left-pane">
        <div class="brand-row">
          <div>
            <h1>SLS SQL Assistant</h1>
            <p>自然语言转阿里云 SLS SQL</p>
          </div>
          <el-tag effect="plain">v0.1</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="解析方式">
            <el-segmented
              v-model="parserMode"
              :options="parserModeOptions"
            />
          </el-form-item>
          <el-form-item label="查询需求">
            <el-input
              v-model="input"
              type="textarea"
              :rows="7"
              resize="none"
              placeholder="输入自然语言查询需求"
            />
          </el-form-item>
          <div class="action-row">
            <el-button type="primary" :loading="loading" @click="handleGenerate">生成 SQL</el-button>
            <el-button :disabled="!result?.sql" @click="copySql">复制 SQL</el-button>
          </div>
        </el-form>

        <div class="examples">
          <div class="section-title">示例需求</div>
          <el-button
            v-for="example in examples"
            :key="example.label"
            class="example-button"
            plain
            @click="useExample(example.text)"
          >
            {{ example.label }}
          </el-button>
        </div>

        <div class="fields">
          <div class="section-title">字段字典</div>
          <el-table :data="fields" height="280" size="small" border>
            <el-table-column prop="field" label="字段" width="120" />
            <el-table-column prop="type" label="类型" width="90" />
            <el-table-column prop="description" label="说明" />
          </el-table>
        </div>
      </aside>

      <section class="right-pane">
        <el-alert
          v-if="error"
          class="result-block"
          type="error"
          :title="error"
          show-icon
          :closable="false"
        />

        <div class="result-block">
          <div class="block-header">
            <div>
              <h2>SQL 结果</h2>
              <span v-if="result?.intent">Intent: {{ result.intent }}</span>
            </div>
            <el-button size="small" :disabled="!result?.sql" @click="copySql">复制</el-button>
          </div>
          <pre class="sql-output">{{ result?.sql || '生成后的 SQL 会显示在这里' }}</pre>
        </div>

        <div class="result-grid">
          <div class="result-block">
            <h2>解析结果 JSON</h2>
            <pre class="json-output">{{ formattedParsed }}</pre>
          </div>

          <div class="result-block">
            <h2>说明</h2>
            <p class="explanation">{{ result?.explanation || '暂无说明' }}</p>
            <el-divider />
            <div class="section-title">字段说明</div>
            <ul class="info-list">
              <li v-for="item in result?.fieldDescriptions || []" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>

        <div v-if="result?.warnings?.length" class="result-block">
          <h2>注意事项</h2>
          <el-alert
            v-for="warning in result.warnings"
            :key="warning"
            class="warning-item"
            type="warning"
            :title="warning"
            show-icon
            :closable="false"
          />
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchFields, generateSql, type FieldDictionaryItem } from '../api/sql'

interface ResultState {
  sql: string
  intent: string
  parsed: unknown
  explanation: string
  warnings: string[]
  fieldDescriptions: string[]
}

const defaultInput = '查询 su 是 https://www.fpffz.top/?channel=news01 的数据，按 type 和 trackType 分组显示'

const input = ref(defaultInput)
const parserMode = ref<'rules' | 'deepseek'>('rules')
const loading = ref(false)
const error = ref('')
const result = ref<ResultState | null>(null)
const fields = ref<FieldDictionaryItem[]>([])

const examples = [
  {
    label: '按 type 和 trackType 分组',
    text: defaultInput
  },
  {
    label: '按 path 分组',
    text: '查询 su 是 https://www.fpffz.top/?channel=news01，step 是 2，type = 6，trackType = 1 的数据，根据 path 分组'
  },
  {
    label: '查有 6-1 无 7-1',
    text: '查询 su 是 https://www.fpffz.top/?channel=news01，有 6-1 但是没有 7-1 的 trackId'
  },
  {
    label: '查 6-1 actionValue 和 11-5 data',
    text: '查询 su 是 https://www.fpffz.top/?channel=news01，有 6-1 没有 7-1，返回 6-1 的 actionValue、11-5 的 data、11-10 的 data'
  },
  {
    label: '查 data 中 reason 分组',
    text: '查询 su 是 https://www.fpffz.top/?channel=news01，按 data 中 reason 字段分组'
  }
]

const parserModeOptions = [
  { label: '本地规则', value: 'rules' },
  { label: 'DeepSeek', value: 'deepseek' }
]

const formattedParsed = computed(() => {
  if (!result.value?.parsed) {
    return '解析后的 JSON 会显示在这里'
  }

  return JSON.stringify(result.value.parsed, null, 2)
})

onMounted(async () => {
  fields.value = await fetchFields()
})

function useExample(text: string) {
  input.value = text
}

async function handleGenerate() {
  if (!input.value.trim()) {
    error.value = '请输入查询需求。'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await generateSql(input.value.trim(), parserMode.value)
    if (!response.success || !response.data) {
      result.value = null
      error.value = response.message ?? 'SQL 生成失败。'
      return
    }

    result.value = response.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : '请求失败。'
  } finally {
    loading.value = false
  }
}

async function copySql() {
  if (!result.value?.sql) {
    return
  }

  await navigator.clipboard.writeText(result.value.sql)
  ElMessage.success('SQL 已复制')
}
</script>

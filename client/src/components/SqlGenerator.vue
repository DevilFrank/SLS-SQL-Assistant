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
					<el-form-item label="查询需求">
						<el-input v-model="input" type="textarea" :rows="7" resize="none" placeholder="输入自然语言查询需求" />
					</el-form-item>
					<div class="action-row">
						<el-button type="primary" :loading="loading" @click="handleGenerate">生成 SQL</el-button>
						<el-button :disabled="!result?.sql" @click="copySql">复制 SQL</el-button>
					</div>
				</el-form>

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
				<el-alert v-if="error" class="result-block" type="error" :title="error" show-icon :closable="false" />

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

				<div v-if="result?.llmTrace" class="result-block">
					<div class="block-header">
						<div>
							<h2>模型对话过程</h2>
							<span>{{ result.llmTrace.provider }} / {{ result.llmTrace.model }}</span>
						</div>
						<el-tag effect="plain">{{ result.llmTrace.finishReason || 'unknown' }}</el-tag>
					</div>

					<div v-if="result.llmTrace.usage" class="usage-row">
						<el-tag>Prompt: {{ result.llmTrace.usage.promptTokens ?? '-' }}</el-tag>
						<el-tag>Completion: {{ result.llmTrace.usage.completionTokens ?? '-' }}</el-tag>
						<el-tag>Total: {{ result.llmTrace.usage.totalTokens ?? '-' }}</el-tag>
					</div>

					<div class="message-list">
						<div v-for="(message, index) in result.llmTrace.messages" :key="`${message.role}-${index}`" class="message-item">
							<div class="message-role">{{ message.role }}</div>
							<pre class="message-content">{{ message.content }}</pre>
						</div>
					</div>

					<template v-if="result.llmTrace.reasoningContent">
						<el-divider />
						<div class="section-title">Reasoning</div>
						<pre class="message-content">{{ result.llmTrace.reasoningContent }}</pre>
					</template>
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

const defaultInput = ''

const input = ref(defaultInput)
const loading = ref(false)
const error = ref('')
const result = ref<ResultState | null>(null)
const fields = ref<FieldDictionaryItem[]>([])

const formattedParsed = computed(() => {
	if (!result.value?.parsed) {
		return '解析后的 JSON 会显示在这里'
	}

	return JSON.stringify(result.value.parsed, null, 2)
})

onMounted(async () => {
	fields.value = await fetchFields()
})

async function handleGenerate() {
	if (!input.value.trim()) {
		error.value = '请输入查询需求。'
		return
	}

	loading.value = true
	error.value = ''

	try {
		const response = await generateSql(input.value.trim())
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

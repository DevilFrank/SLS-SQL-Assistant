# SLS SQL Assistant

SLS SQL Assistant 是一个面向阿里云日志服务 SLS 的内部 SQL 生成工具。第一版只负责把自然语言查询需求解析成结构化 JSON，再经过字段校验和固定模板生成可复制到 SLS 控制台执行的 SQL，不直接调用阿里云 SLS API。

## 技术栈

- 前端：Vue 3 + TypeScript + Element Plus + Vite
- 后端：Node.js + Express + TypeScript
- SQL 生成：规则解析 -> 结构化 JSON -> 字段/类型校验 -> SLS SQL 模板渲染

## 安装

```bash
npm install
```

## 启动

```bash
npm run dev
```

默认服务：

- 后端：`http://localhost:3000`
- 前端：Vite 默认端口，通常是 `http://localhost:5173`

## DeepSeek 解析

项目支持可选接入 DeepSeek API。DeepSeek 只用于把自然语言解析成 `ParsedQuery` JSON，不直接生成 SQL；字段校验、类型处理、SQL 转义和模板渲染仍由后端固定代码完成。

在项目根目录 `.env` 中配置：

```bash
DEEPSEEK_API_KEY=你的 key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_MAX_TOKENS=2048
DEEPSEEK_TEMPERATURE=0
DEEPSEEK_TOP_P=1
DEEPSEEK_THINKING=disabled
# 如果 DEEPSEEK_THINKING=enabled，可设置 low / medium / high
DEEPSEEK_REASONING_EFFORT=medium
```

当前实现没有引入 `openai` 或 `axios` 包，而是使用 Node.js 内置 `fetch` 直接请求：

```text
POST https://api.deepseek.com/chat/completions
```

这和 DeepSeek demo 中的 axios 请求是同一个接口。由于本项目需要稳定返回 `ParsedQuery`，所以默认使用：

```json
{
  "response_format": { "type": "json_object" },
  "thinking": { "type": "disabled" },
  "temperature": 0
}
```

前端页面默认只使用 DeepSeek 解析，并会展示本次请求发送给模型的 messages、模型原始返回、finish reason 和 token usage。接口请求示例：

```json
{
  "input": "查询 su 是 https://www.fpffz.top/?channel=news01 的数据，按 type 和 trackType 分组显示",
  "options": {
    "defaultLimit": 1000,
    "suMatchMode": "like"
  }
}
```

也可以单独启动：

```bash
npm run dev:server
npm run dev:client
```

## 接口

### POST `/api/sql/generate`

```json
{
  "input": "查询 su 是 https://www.fpffz.top/?channel=news01 的数据，按 type 和 trackType 分组显示",
  "options": {
    "defaultLimit": 1000,
    "suMatchMode": "like"
  }
}
```

### GET `/api/sql/fields`

返回内置日志字段字典，供字段选择器、字段说明和后续 AI 上下文使用。

## 支持的查询类型

- `group_count`：普通分组统计
- `raw_filter`：普通过滤明细查询
- `missing_event`：同一 `trackId` 下有 A 事件但没有 B 事件
- `missing_event_with_fields`：有 A 无 B，并返回指定事件字段
- `data_json_group_count`：按 `data` 中 JSON 字段分组统计

## 示例

输入：

```text
查询 su 是 https://www.fpffz.top/?channel=news01 的数据，按 type 和 trackType 分组显示
```

输出：

```sql
*
| SELECT
    count(*) AS cnt,
    (type, trackType) AS cc
FROM log
WHERE su LIKE '%https://www.fpffz.top/?channel=news01%'
GROUP BY cc
ORDER BY cnt DESC
```

输入：

```text
查询 su 是 https://www.fpffz.top/?channel=news01，有 6-1 没有 7-1，返回 6-1 的 actionValue、11-5 的 data、11-10 的 data
```

输出：

```sql
*
| SELECT
    trackId,
    arbitrary(
      CASE
        WHEN type = 6 AND trackType = 1 THEN actionValue
        ELSE NULL
      END
    ) AS actionValue,
    arbitrary(
      CASE
        WHEN type = 11 AND trackType = 5 THEN data
        ELSE NULL
      END
    ) AS data_11_5,
    arbitrary(
      CASE
        WHEN type = 11 AND trackType = 10 THEN data
        ELSE NULL
      END
    ) AS data_11_10
FROM log
WHERE su LIKE '%https://www.fpffz.top/?channel=news01%'
GROUP BY trackId
HAVING
    SUM(CASE WHEN type = 6 AND trackType = 1 THEN 1 ELSE 0 END) > 0
    AND
    SUM(CASE WHEN type = 7 AND trackType = 1 THEN 1 ELSE 0 END) = 0
LIMIT 100000
```

## 后续扩展计划

- 接入阿里云 SLS GetLogs API，一键执行并展示结果
- 接入大模型解析自然语言，但仍保持模板化 SQL 渲染
- 保存历史 SQL 和常用模板
- 增加字段选择器、字段补全和查询模板管理
- 对查询结果做自动解释和异常链路诊断

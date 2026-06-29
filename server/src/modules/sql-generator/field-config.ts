import type { FieldType } from './types.js'

export interface FieldDictionaryItem {
  field: string
  type: FieldType
  required: boolean
  description: string
  example: string
}

export const fieldDictionary: FieldDictionaryItem[] = [
  { field: 'requestId', type: 'string', required: false, description: '请求ID，若不传则自动生成 UUID', example: 'a1b2c3d4e5f6' },
  { field: 'time', type: 'number', required: false, description: '请求时间戳，毫秒', example: '1687425600000' },
  { field: 'ip', type: 'string', required: false, description: '客户端IP', example: '192.168.1.1' },
  { field: 'cid', type: 'string', required: false, description: '广告位ID', example: 'ad_001' },
  { field: 'packageName', type: 'string', required: false, description: '宿主包名', example: 'com.example.app' },
  { field: 'sdkVer', type: 'string', required: false, description: 'SDK版本', example: '1.2.3' },
  { field: 'gid', type: 'string', required: false, description: '谷歌ID', example: 'google_123' },
  { field: 'model', type: 'string', required: false, description: '设备型号', example: 'Pixel 6' },
  { field: 'brand', type: 'string', required: false, description: '设备品牌', example: 'Google' },
  { field: 'os', type: 'string', required: false, description: '系统类型', example: 'android' },
  { field: 'osv', type: 'string', required: false, description: '系统版本', example: '13' },
  { field: 'ua', type: 'string', required: false, description: 'User-Agent', example: 'Mozilla/5.0...' },
  { field: 'trackId', type: 'string', required: false, description: '跟踪ID，用于串联一次完整行为链路', example: 'track_001' },
  { field: 'taskId', type: 'string', required: true, description: '任务ID', example: 'task_001' },
  { field: 'type', type: 'number', required: true, description: '一级跟踪类型。接口上报可能是 String，但 SLS 查询中按 number 处理', example: '3' },
  { field: 'trackType', type: 'number', required: true, description: '二级跟踪类型。接口上报可能是 String，但 SLS 查询中按 number 处理', example: '1' },
  { field: 'code', type: 'number', required: false, description: '状态码。SLS 查询中优先按 number 处理', example: '200' },
  { field: 'step', type: 'number', required: false, description: '执行步骤', example: '1' },
  { field: 'action', type: 'string', required: false, description: '行为定义', example: 'description' },
  { field: 'actionValue', type: 'string', required: false, description: '行为参数', example: 'pageDepth' },
  { field: 'su', type: 'string', required: false, description: '广告链接 / 当前查询目标 URL', example: 'https://example.com' },
  { field: 'path', type: 'string', required: false, description: '客户端当前页面', example: '/home' },
  { field: 'keyWord', type: 'string', required: false, description: '关键词', example: '搜索内容' },
  { field: 'data', type: 'json', required: false, description: '其他非标准扩展数据', example: '{}' }
]

export const fieldTypeMap = Object.fromEntries(
  fieldDictionary.map((item) => [item.field, item.type])
) as Record<string, FieldType>

export const fieldDescriptionMap = Object.fromEntries(
  fieldDictionary.map((item) => [item.field, item])
) as Record<string, FieldDictionaryItem>

export const knownFields = new Set(fieldDictionary.map((item) => item.field))

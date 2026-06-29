import { Router } from 'express'
import { fieldDictionary } from '../modules/sql-generator/field-config.js'
import { generateSql } from '../modules/sql-generator/index.js'

export const sqlRouter = Router()

sqlRouter.get('/fields', (_req, res) => {
  res.json({
    success: true,
    data: fieldDictionary
  })
})

sqlRouter.post('/generate', async (req, res, next) => {
  const input = typeof req.body?.input === 'string' ? req.body.input.trim() : ''

  if (!input) {
    res.status(400).json({
      success: false,
      message: '请输入自然语言查询需求。'
    })
    return
  }

  try {
    const result = await generateSql(input, req.body?.options ?? {})
    res.status(result.success ? 200 : 422).json(result)
  } catch (error) {
    next(error)
  }
})

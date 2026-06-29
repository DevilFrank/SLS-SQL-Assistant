import cors from 'cors'
import express from 'express'
import { sqlRouter } from './routes/sql.routes.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ success: true })
})

app.use('/api/sql', sqlRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({ success: false, message })
})

app.listen(port, () => {
  console.log(`SLS SQL Assistant API listening on http://localhost:${port}`)
})

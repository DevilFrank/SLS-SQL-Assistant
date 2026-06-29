import fs from 'node:fs'
import path from 'node:path'

let loaded = false

export function loadDotEnv() {
  if (loaded) {
    return
  }

  loaded = true
  const envPath = path.resolve(process.cwd(), '.env')

  if (!fs.existsSync(envPath)) {
    return
  }

  const content = fs.readFileSync(envPath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, equalIndex).trim()
    const rawValue = trimmed.slice(equalIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

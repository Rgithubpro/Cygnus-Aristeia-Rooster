#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const MAX_USERS = 1000
const DEFAULTS = { users: 800, rampSeconds: 300, durationSeconds: 900 }
const RPC_TIMEOUT_MS = 30_000
let stopping = false

const help = `Usage:
  node scripts/load-test.mjs --app-url URL --supabase-url URL --participants FILE --confirm-nonproduction [options]

Options:
  --users N             Simulated students (1-${MAX_USERS}; default ${DEFAULTS.users})
  --ramp-seconds N      Stagger logins over at least 120 seconds (default ${DEFAULTS.rampSeconds})
  --duration-seconds N  Total run time; must be at least ramp + 60 seconds (default ${DEFAULTS.durationSeconds})
  --app-url URL         Non-production app URL
  --supabase-url URL    Non-production Supabase project URL
  --participants FILE   JSON array of class credentials; see README.md
  --confirm-nonproduction
                        Explicitly confirm both URLs point to an isolated non-production environment
  --dry-run             Validate options and print the planned run without sending requests
  --help                Show this help

Equivalent environment variables:
  LOADTEST_APP_URL, LOADTEST_SUPABASE_URL, LOADTEST_PARTICIPANTS

This runner only simulates the student-facing flow. It creates and removes temporary
login sessions, but never edits school content or triggers push notifications.
`

function argumentsFrom(argv) {
  const options = { ...DEFAULTS, dryRun: false, confirmed: false }
  const flags = new Map([
    ['--app-url', 'appUrl'],
    ['--supabase-url', 'supabaseUrl'],
    ['--participants', 'participantsFile'],
    ['--users', 'users'],
    ['--ramp-seconds', 'rampSeconds'],
    ['--duration-seconds', 'durationSeconds'],
  ])
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') {
      options.help = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--confirm-nonproduction') {
      options.confirmed = true
    } else if (flags.has(arg)) {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`)
      options[flags.get(arg)] = value
      i += 1
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }
  options.appUrl ||= process.env.LOADTEST_APP_URL
  options.supabaseUrl ||= process.env.LOADTEST_SUPABASE_URL
  options.participantsFile ||= process.env.LOADTEST_PARTICIPANTS
  for (const key of ['users', 'rampSeconds', 'durationSeconds']) {
    if (typeof options[key] === 'string') {
      if (!/^\d+$/.test(options[key])) throw new Error(`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} must be a whole number`)
      options[key] = Number(options[key])
    }
  }
  return options
}

function validateUrl(value, label) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be a valid absolute URL`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be an HTTP(S) base URL without credentials, query, or fragment`)
  }
  return url
}

function isPublicSupabaseKey(key) {
  if (key.startsWith('sb_publishable_')) return true
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role === 'anon'
  } catch {
    return false
  }
}

async function loadConfig(options) {
  if (!options.appUrl || !options.supabaseUrl || !options.participantsFile) {
    throw new Error('Provide --app-url, --supabase-url, and --participants (or their environment variables)')
  }
  const appUrl = validateUrl(options.appUrl, '--app-url')
  const supabaseUrl = validateUrl(options.supabaseUrl, '--supabase-url')
  if (!options.confirmed && !options.dryRun) {
    throw new Error('Refusing to send traffic without --confirm-nonproduction. Use isolated non-production URLs only.')
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
  for (const [label, url] of [['--app-url', appUrl], ['--supabase-url', supabaseUrl]]) {
    if (url.protocol !== 'https:' && !localHosts.has(url.hostname)) {
      throw new Error(`${label} must use HTTPS unless it targets localhost`)
    }
  }
  if (!Number.isInteger(options.users) || options.users < 1 || options.users > MAX_USERS) {
    throw new Error(`--users must be an integer from 1 to ${MAX_USERS}`)
  }
  if (!Number.isInteger(options.rampSeconds) || options.rampSeconds < 120) {
    throw new Error('--ramp-seconds must be an integer of at least 120')
  }
  if (!Number.isInteger(options.durationSeconds) || options.durationSeconds < options.rampSeconds + 60) {
    throw new Error('--duration-seconds must be at least ramp-seconds + 60')
  }
  const apiKey = process.env.LOADTEST_SUPABASE_KEY
  if (!apiKey && !options.dryRun) throw new Error('Set LOADTEST_SUPABASE_KEY to the project’s public anon/publishable key')
  if (apiKey && !isPublicSupabaseKey(apiKey)) {
    throw new Error('LOADTEST_SUPABASE_KEY must be a public anon/publishable key, never a service-role key')
  }

  let participants
  try {
    participants = JSON.parse(await readFile(options.participantsFile, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read participants JSON: ${error.message}`)
  }
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('Participants file must contain a non-empty JSON array')
  }
  for (const [index, entry] of participants.entries()) {
    if (
      !entry ||
      typeof entry.slug !== 'string' ||
      !/^[a-z0-9-]+$/i.test(entry.slug) ||
      typeof entry.password !== 'string' ||
      entry.password.length === 0 ||
      (entry.weight !== undefined && (!Number.isFinite(entry.weight) || entry.weight <= 0))
    ) {
      throw new Error(`Invalid participant entry at array index ${index}; expected slug, password, and optional positive weight`)
    }
  }
  return { ...options, appUrl, supabaseUrl, apiKey, participants }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function chooseParticipant(participants) {
  const total = participants.reduce((sum, item) => sum + (item.weight ?? 1), 0)
  let pick = Math.random() * total
  for (const item of participants) {
    pick -= item.weight ?? 1
    if (pick < 0) return item
  }
  return participants.at(-1)
}

function percentile(samples, ratio) {
  if (samples.length === 0) return 0
  return samples[Math.min(samples.length - 1, Math.ceil(samples.length * ratio) - 1)]
}

const metrics = new Map()
function record(name, elapsed, failed = false) {
  const item = metrics.get(name) ?? { count: 0, failures: 0, times: [] }
  item.count += 1
  if (failed) item.failures += 1
  item.times.push(elapsed)
  metrics.set(name, item)
}

async function measured(name, operation) {
  const began = performance.now()
  try {
    const result = await operation()
    record(name, performance.now() - began)
    return result
  } catch (error) {
    record(name, performance.now() - began, true)
    throw error
  }
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function requestShell(appUrl) {
  return measured('app-shell', async () => {
    const response = await fetchWithTimeout(appUrl, { headers: { Accept: 'text/html' } })
    if (!response.ok) throw new Error(`app-shell_http_${response.status}`)
    const html = await response.text()
    const assets = new Set()
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)) {
      const asset = new URL(match[1], appUrl)
      if (asset.origin === appUrl.origin) assets.add(asset.href)
    }
    if (assets.size > 0) {
      await Promise.all([...assets].map((asset) =>
        measured('app-asset', async () => {
          const assetResponse = await fetchWithTimeout(asset, {})
          if (!assetResponse.ok) throw new Error(`app-asset_http_${assetResponse.status}`)
          await assetResponse.arrayBuffer()
        }),
      ))
    }
  })
}

async function rpc(config, name, args = {}) {
  return measured(name, async () => {
    const response = await fetchWithTimeout(new URL(`/rest/v1/rpc/${name}`, config.supabaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
        ...(config.apiKey.startsWith('eyJ') ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(args),
    })
    const body = await response.text()
    if (!response.ok) throw new Error(`${name}_http_${response.status}`)
    if (!body) return null
    try {
      return JSON.parse(body)
    } catch {
      throw new Error(`${name}_invalid_json`)
    }
  })
}

async function waitUntil(time) {
  while (!stopping) {
    const left = time - Date.now()
    if (left <= 0) return
    await sleep(Math.min(left, 1000))
  }
}

async function simulateUser(config, participant, arrivesAt, endAt) {
  let token
  try {
    await waitUntil(arrivesAt)
    if (stopping) return
    await requestShell(config.appUrl)
    await rpc(config, 'start_info')
    await sleep(randomBetween(1000, 5000))
    const login = await rpc(config, 'inloggen', {
      p_slug: participant.slug,
      p_wachtwoord: participant.password,
    })
    if (!login?.token || login.fout) throw new Error(`login_rejected_${login?.fout || 'no_token'}`)
    token = login.token
    if (login.rol !== 'leerling') throw new Error('login_rejected_not_a_student_account')

    let data = await rpc(config, 'alles', { p_token: token })
    const students = data?.leerlingen ?? []
    if (students.length > 0) {
      await sleep(randomBetween(1000, 4000))
      const student = students[Math.floor(Math.random() * students.length)]
      await rpc(config, 'kies_leerling', { p_token: token, p_leerling_id: student.id })
      data = await rpc(config, 'alles', { p_token: token })
    }

    if (Math.random() < 0.15) await rpc(config, 'pagina_ophalen', { p_token: token })
    let nextStandAt = Date.now() + randomBetween(120_000, 360_000)
    while (!stopping && Date.now() < endAt) {
      await waitUntil(Math.min(Date.now() + randomBetween(50_000, 75_000), endAt))
      if (stopping || Date.now() >= endAt) break
      const version = await rpc(config, 'ververs', { p_token: token })
      if (version !== data?.versie) data = await rpc(config, 'alles', { p_token: token })
      if (Date.now() >= nextStandAt) {
        await rpc(config, 'stand_dag_leagues', { p_token: token })
        nextStandAt = Date.now() + randomBetween(120_000, 360_000)
      }
    }
  } catch (error) {
    if (!stopping) {
      const reason = error.name === 'AbortError' ? 'request_timeout' : error.message
      record(`user-error:${reason}`, 0, true)
    }
  } finally {
    if (token) {
      try {
        await rpc(config, 'uitloggen', { p_token: token })
      } catch {
        // The request-level failure is already counted; don't print session data.
      }
    }
  }
}

function printSummary(startedAt, finishedAt) {
  console.log(`\nRun finished in ${((finishedAt - startedAt) / 1000).toFixed(1)}s.`)
  console.log('Operation             Requests  Failures  p50 ms  p95 ms')
  for (const [name, item] of [...metrics.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const times = item.times.sort((a, b) => a - b)
    console.log(
      `${name.padEnd(22)} ${String(item.count).padStart(8)}  ${String(item.failures).padStart(8)}  ${String(Math.round(percentile(times, 0.5))).padStart(6)}  ${String(Math.round(percentile(times, 0.95))).padStart(6)}`,
    )
  }
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2))
  if (options.help) {
    console.log(help)
    return
  }
  const config = await loadConfig(options)
  if (config.dryRun) {
    console.log(`Dry run: ${config.users} users; ${config.rampSeconds}s ramp; ${config.durationSeconds}s total.`)
    console.log(`App: ${config.appUrl.origin}; Supabase: ${config.supabaseUrl.origin}; classes: ${config.participants.length}.`)
    console.log('No requests sent.')
    return
  }

  process.on('SIGINT', () => { stopping = true })
  process.on('SIGTERM', () => { stopping = true })
  const start = Date.now()
  const end = start + config.durationSeconds * 1000
  console.log(`Starting ${config.users} simulated students; ramp ${config.rampSeconds}s; total ${config.durationSeconds}s.`)
  console.log('Press Ctrl+C to stop; active sessions will be logged out where possible.')
  const users = Array.from({ length: config.users }, (_, index) => {
    const offset = config.users === 1 ? 0 : (index / (config.users - 1)) * config.rampSeconds * 1000
    const participant = chooseParticipant(config.participants)
    return simulateUser(config, participant, start + offset, end)
  })
  await Promise.all(users)
  printSummary(start, Date.now())
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`Load test could not start: ${error.message}`)
    process.exitCode = 1
  })
}

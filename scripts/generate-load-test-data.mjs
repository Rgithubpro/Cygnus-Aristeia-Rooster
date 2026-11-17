#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_STUDENTS = 1000
const MAX_CLASSES = 100
const MAX_STUDENTS_PER_CLASS = 35

const help = `Usage:
  npm run loadtest:generate -- --classes NUMBER --students-per-class NUMBER [--output-dir DIRECTORY]

Options:
  --classes NUMBER             Number of test classes (1-${MAX_CLASSES})
  --students-per-class NUMBER  Students in each test class (1-${MAX_STUDENTS_PER_CLASS}; total capped at ${MAX_STUDENTS})
  --output-dir DIRECTORY       Where to save generated files (default: ./load-test-fixtures)
  --help                       Show this help

Creates setup.sql, cleanup.sql, and participants.json. Run setup.sql once in
the Supabase SQL Editor for your isolated test project, then use participants.json
with the load-test runner. No database connection is made by this generator.
`

function parseArgs(argv) {
  const options = { outputDir: 'load-test-fixtures' }
  const flags = new Map([
    ['--classes', 'classes'],
    ['--students-per-class', 'studentsPerClass'],
    ['--output-dir', 'outputDir'],
  ])
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') {
      options.help = true
    } else if (flags.has(arg)) {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`)
      options[flags.get(arg)] = value
      i += 1
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }
  return options
}

function positiveInt(value, flag, max) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
    throw new Error(`${flag} must be a whole number from 1 to ${max}`)
  }
  return Number(value)
}

function sqlString(value) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`
}

function generateFiles(classes, studentsPerClass) {
  const runId = randomBytes(4).toString('hex')
  const participants = []
  const setup = [
    '-- Generated test fixtures. Run only in an isolated non-production Supabase project.',
    `-- Run ID: ${runId}; classes: ${classes}; students per class: ${studentsPerClass}.`,
    '-- This creates class records and student names; it does not add activities or announcements.',
    'begin;',
  ]
  const cleanup = [
    '-- Removes only the generated classes for this run ID.',
    `-- Run ID: ${runId}. Check the target database before executing.`,
    'begin;',
    `delete from public.klassen where slug like ${sqlString(`loadtest-${runId}-%`)};`,
    'commit;',
  ]

  for (let classIndex = 1; classIndex <= classes; classIndex += 1) {
    const suffix = String(classIndex).padStart(3, '0')
    const slug = `loadtest-${runId}-${suffix}`
    const className = `Load test ${runId} ${suffix}`
    const studentPassword = randomBytes(18).toString('base64url')
    const adminPassword = randomBytes(18).toString('base64url')
    const names = Array.from({ length: studentsPerClass }, (_, studentIndex) =>
      `Test student ${String((classIndex - 1) * studentsPerClass + studentIndex + 1).padStart(4, '0')}`,
    )
    setup.push(
      'do $loadtest$',
      'declare',
      '  v_klas_id uuid;',
      'begin',
      `  v_klas_id := public._maak_klas(${sqlString(className)}, ${sqlString(slug)}, ${sqlString(studentPassword)}, ${sqlString(adminPassword)});`,
      `  perform public._leerlingen_toevoegen(v_klas_id, E${sqlString(names.join('\n'))});`,
      'end',
      '$loadtest$;',
    )
    participants.push({ slug, password: studentPassword })
  }
  setup.push('commit;')

  return {
    runId,
    setup: `${setup.join('\n')}\n`,
    cleanup: `${cleanup.join('\n')}\n`,
    participants: `${JSON.stringify(participants, null, 2)}\n`,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(help)
    return
  }
  const classes = positiveInt(options.classes, '--classes', MAX_CLASSES)
  const studentsPerClass = positiveInt(options.studentsPerClass, '--students-per-class', MAX_STUDENTS_PER_CLASS)
  if (classes * studentsPerClass > MAX_STUDENTS) {
    throw new Error(`Total test students cannot exceed ${MAX_STUDENTS}; requested ${classes * studentsPerClass}`)
  }
  const files = generateFiles(classes, studentsPerClass)
  const outputDir = resolve(options.outputDir)
  await mkdir(outputDir, { recursive: true })
  const output = [
    ['setup.sql', files.setup],
    ['cleanup.sql', files.cleanup],
    ['participants.json', files.participants],
  ]
  for (const [name, content] of output) {
    await writeFile(resolve(outputDir, name), content, { flag: 'wx', mode: 0o600 })
  }
  console.log(`Generated ${classes} classes with ${studentsPerClass} students each (${classes * studentsPerClass} total).`)
  console.log(`Run ID: ${files.runId}`)
  console.log(`Files saved in: ${outputDir}`)
  console.log('Next: run setup.sql in the test project’s Supabase SQL Editor, then use participants.json with the load-test runner.')
  console.log('Keep these files private; setup.sql and participants.json contain test passwords.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`Could not generate load-test data: ${error.message}`)
    process.exitCode = 1
  })
}

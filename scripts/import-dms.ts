#!/usr/bin/env npx tsx
/**
 * Bulk import Instagram DM conversations into the Knowledge Base.
 *
 * Usage:
 *   IMPORT_SECRET=xxx API_URL=https://your-app.vercel.app npx tsx scripts/import-dms.ts
 *
 * Flags:
 *   --dry-run        Count and format, don't send to API
 *   --reset          Clear progress file, start fresh
 *   --batch-size N   Documents per API call (default 10)
 *   --concurrency N  Parallel batches (default 3)
 *   --inbox PATH     Override inbox directory
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_INBOX = '/Users/markosrnec5/Documents/DMs-Lars/first-batch/messages/inbox'
const PROGRESS_FILE = path.join(__dirname, '.import-progress.json')
const MIN_TEXT_MESSAGES = 3
const LARS_NAME_PATTERN = /lars/i

// ── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const RESET = args.includes('--reset')
const BATCH_SIZE = getArgInt('--batch-size', 10)
const CONCURRENCY = getArgInt('--concurrency', 3)
const INBOX_DIR = getArgStr('--inbox', DEFAULT_INBOX)
const API_URL = process.env.API_URL || 'https://blackops-dm-app.vercel.app'
const IMPORT_SECRET = process.env.IMPORT_SECRET

function getArgInt(flag: string, def: number): number {
  const idx = args.indexOf(flag)
  return idx >= 0 && args[idx + 1] ? parseInt(args[idx + 1], 10) : def
}

function getArgStr(flag: string, def: string): string {
  const idx = args.indexOf(flag)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def
}

// ── Types ───────────────────────────────────────────────────────────────────

interface IGMessage {
  sender_name: string
  timestamp_ms: number
  content?: string
  audio_files?: { uri: string }[]
  photos?: { uri: string }[]
  videos?: { uri: string }[]
  share?: { link?: string; share_text?: string }
  reactions?: { reaction: string; actor: string }[]
}

interface IGConversation {
  participants: { name: string }[]
  messages: IGMessage[]
}

interface Progress {
  completed: string[]
  failed: string[]
}

// ── Instagram UTF-8 Fix ────────────────────────────────────────────────────

function decodeInstagramEncoding(text: string): string {
  try {
    // Instagram exports UTF-8 bytes as Latin-1 characters
    // Convert each char code to a byte, then decode as UTF-8
    const bytes = new Uint8Array(text.split('').map(c => c.charCodeAt(0)))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return text
  }
}

// ── Format Conversation ────────────────────────────────────────────────────

function formatConversation(convo: IGConversation, folderName: string): { title: string; content: string } | null {
  const participants = convo.participants.map(p => decodeInstagramEncoding(p.name))
  const larsName = participants.find(n => LARS_NAME_PATTERN.test(n))
  if (!larsName) return null

  const leadName = participants.find(n => n !== larsName) || 'Unknown'

  // Messages are reverse chronological in the export — reverse to chronological
  const messages = [...convo.messages].reverse()

  // Filter to text messages only for the minimum count check
  const textMessages = messages.filter(m => m.content)
  if (textMessages.length < MIN_TEXT_MESSAGES) return null

  // Build transcript
  const lines: string[] = []
  let lastDateStr = ''
  let larsCount = 0
  let leadCount = 0

  for (const msg of messages) {
    const date = new Date(msg.timestamp_ms)
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

    if (dateStr !== lastDateStr) {
      if (lines.length > 0) lines.push('')
      lines.push(`--- ${dateStr} ---`)
      lines.push('')
      lastDateStr = dateStr
    }

    const isLars = msg.sender_name === larsName || LARS_NAME_PATTERN.test(msg.sender_name)
    const label = isLars ? 'LARS' : 'LEAD'
    if (isLars) larsCount++
    else leadCount++

    let text = ''
    if (msg.content) {
      text = decodeInstagramEncoding(msg.content)
    } else if (msg.audio_files && msg.audio_files.length > 0) {
      text = '[Voice message]'
    } else if (msg.photos && msg.photos.length > 0) {
      text = '[Photo]'
    } else if (msg.videos && msg.videos.length > 0) {
      text = '[Video]'
    } else if (msg.share?.link) {
      text = msg.share.link
    } else {
      text = '[Media]'
    }

    lines.push(`[${timeStr}] ${label}: ${text}`)
  }

  const firstDate = new Date(messages[0].timestamp_ms)
  const lastDate = new Date(messages[messages.length - 1].timestamp_ms)
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const shortLeadName = leadName.split(' ').slice(0, 2).join(' ')
  const title = `DM: ${shortLeadName} (${folderName})`

  const header = [
    `# Instagram DM Conversation`,
    `**Lead:** ${decodeInstagramEncoding(leadName)}`,
    `**Date range:** ${fmtDate(firstDate)} to ${fmtDate(lastDate)}`,
    `**Messages:** ${messages.length} (Lars: ${larsCount}, Lead: ${leadCount})`,
    '',
    '## Transcript',
    '',
  ].join('\n')

  return { title, content: header + lines.join('\n') }
}

// ── Progress Tracking ──────────────────────────────────────────────────────

function loadProgress(): Progress {
  if (RESET && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE)
  }
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
  }
  return { completed: [], failed: [] }
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// ── API Call ────────────────────────────────────────────────────────────────

async function sendBatch(documents: { title: string; content: string; type: string; file_type: string; folder_name: string }[]) {
  const res = await fetch(`${API_URL}/api/workers/bulk-import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-import-secret': IMPORT_SECRET!,
    },
    body: JSON.stringify({ documents }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  return res.json() as Promise<{
    results: { folder: string; id?: string; status: string; error?: string }[]
    summary: { succeeded: number; duplicates: number; failed: number }
  }>
}

// ── Progress Bar ────────────────────────────────────────────────────────────

function progressBar(current: number, total: number, extra = ''): string {
  const width = 30
  const filled = Math.round((current / total) * width)
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled)
  const pct = ((current / total) * 100).toFixed(1)
  return `[${bar}] ${pct}% (${current}/${total}) ${extra}`
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Instagram DM Bulk Import ===\n')

  if (!DRY_RUN && !IMPORT_SECRET) {
    console.error('Error: IMPORT_SECRET env var is required (or use --dry-run)')
    process.exit(1)
  }

  if (!fs.existsSync(INBOX_DIR)) {
    console.error(`Error: Inbox directory not found: ${INBOX_DIR}`)
    process.exit(1)
  }

  // Scan folders
  const folders = fs.readdirSync(INBOX_DIR).filter(f => {
    const msgFile = path.join(INBOX_DIR, f, 'message_1.json')
    return fs.existsSync(msgFile)
  })

  console.log(`Found ${folders.length} conversation folders`)

  // Load progress for resume
  const progress = loadProgress()
  const alreadyDone = new Set([...progress.completed, ...progress.failed])
  const pending = folders.filter(f => !alreadyDone.has(f))

  console.log(`Already processed: ${alreadyDone.size} (${progress.completed.length} ok, ${progress.failed.length} failed)`)
  console.log(`Remaining: ${pending.length}`)

  // Parse and format all pending conversations
  const documents: { folder: string; title: string; content: string }[] = []
  let skipped = 0

  for (const folder of pending) {
    try {
      const raw = fs.readFileSync(path.join(INBOX_DIR, folder, 'message_1.json'), 'utf-8')
      const convo: IGConversation = JSON.parse(raw)
      const formatted = formatConversation(convo, folder)
      if (formatted) {
        documents.push({ folder, ...formatted })
      } else {
        skipped++
      }
    } catch (err) {
      skipped++
    }
  }

  console.log(`\nEligible conversations: ${documents.length}`)
  console.log(`Skipped (< ${MIN_TEXT_MESSAGES} text messages or no Lars): ${skipped}`)

  if (DRY_RUN) {
    console.log('\n--- DRY RUN ---')
    console.log(`Would import ${documents.length} conversations`)
    if (documents.length > 0) {
      console.log('\nSample document:')
      console.log(`Title: ${documents[0].title}`)
      console.log(`Content length: ${documents[0].content.length} chars`)
      console.log(`Content preview:\n${documents[0].content.slice(0, 500)}...`)
    }
    // Show a few more titles
    console.log('\nFirst 10 titles:')
    for (const doc of documents.slice(0, 10)) {
      console.log(`  - ${doc.title} (${doc.content.length} chars)`)
    }
    return
  }

  if (documents.length === 0) {
    console.log('Nothing to import!')
    return
  }

  // Split into batches
  const batches: typeof documents[] = []
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    batches.push(documents.slice(i, i + BATCH_SIZE))
  }

  console.log(`\nSending ${batches.length} batches (${BATCH_SIZE} docs each, ${CONCURRENCY} concurrent)`)
  console.log(`API: ${API_URL}\n`)

  let totalSucceeded = 0
  let totalDuplicates = 0
  let totalFailed = 0
  let batchesDone = 0

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY)

    const results = await Promise.allSettled(
      chunk.map(batch =>
        sendBatch(
          batch.map(d => ({
            title: d.title,
            content: d.content,
            type: 'training',
            file_type: 'dm_conversation',
            folder_name: d.folder,
          }))
        )
      )
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const batch = chunk[j]

      if (result.status === 'fulfilled') {
        const { summary, results: docResults } = result.value
        totalSucceeded += summary.succeeded
        totalDuplicates += summary.duplicates
        totalFailed += summary.failed

        // Update progress
        for (const r of docResults) {
          if (r.status === 'failed') {
            progress.failed.push(r.folder)
          } else {
            progress.completed.push(r.folder)
          }
        }
      } else {
        // Entire batch failed
        totalFailed += batch.length
        for (const d of batch) {
          progress.failed.push(d.folder)
        }
        console.error(`\nBatch failed: ${result.reason}`)
      }

      batchesDone++
    }

    saveProgress(progress)
    process.stdout.write(`\r${progressBar(batchesDone, batches.length, `| OK: ${totalSucceeded} Dup: ${totalDuplicates} Fail: ${totalFailed}`)}`)
  }

  console.log('\n\n=== Import Complete ===')
  console.log(`Succeeded: ${totalSucceeded}`)
  console.log(`Duplicates: ${totalDuplicates}`)
  console.log(`Failed: ${totalFailed}`)
  console.log(`Progress saved to: ${PROGRESS_FILE}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

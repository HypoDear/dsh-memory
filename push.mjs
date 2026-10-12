#!/usr/bin/env node
/**
 * 把本地改动推送到远程仓库 —— 替代 git push。
 *
 * 为什么需要它：`sync.mjs` 只解决「远程 → 本地」。反过来（本地 → 远程）
 * 原本只能靠 GitHub MCP 工具，而它要求把**整个文件内容**作为参数传一遍 ——
 * 大文件（如 `index.html`）既慢又费 token。
 *
 * 这个脚本直接读本地文件、走 GitHub Contents API 推送，只传差异判断所需的最小信息。
 *
 * ⚠️ 需要 token（写权限）：读 `MCP_GITHUB_TOKEN` / `GITHUB_TOKEN` / `GH_TOKEN`。
 *
 * 用法:
 *   node push.mjs                  # 推送所有与远程不同的文件
 *   node push.mjs index.html       # 只推指定文件
 *   node push.mjs --dry-run        # 只看哪些会推，不实际提交
 *   node push.mjs -m "说明"        # 自定义提交信息
 *
 * 零依赖，需要 Node 18+。
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OWNER = 'HypoDear'
const REPO = 'dsh-memory'
const BRANCH = 'main'
const API = `https://api.github.com/repos/${OWNER}/${REPO}`

/** 参与推送的文件 —— 与 sync.mjs 的结构性清单保持一致。 */
const STRUCTURAL_FILES = [
  'AGENTS.md',
  'README.md',
  'SPEC.md',
  'manifest.json',
  'index.html',
  'sync.mjs',
  'push.mjs',
  'verify.mjs',
  '.gitignore',
  'memory/README.md',
  'memory/_template.md',
]

const ROOT = import.meta.dirname ?? process.cwd()

function authHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-memory-push',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  for (const name of ['MCP_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) {
    const v = process.env[name]
    if (typeof v === 'string' && v.trim() !== '') {
      headers.Authorization = `Bearer ${v.trim()}`
      return headers
    }
  }
  throw new Error(
    '未检测到 GitHub token。请设置 MCP_GITHUB_TOKEN（或 GITHUB_TOKEN / GH_TOKEN）—— 推送需要写权限。',
  )
}

const HEADERS = authHeaders()
const norm = (s) => s.replace(/\r\n/g, '\n').trim()

/** 取远程某文件的当前内容与 blob sha；不存在则返回 undefined。 */
async function remoteFile(path) {
  const res = await fetch(`${API}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`, {
    headers: HEADERS,
    cache: 'no-store',
  })
  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`读取远程失败 HTTP ${res.status}`)
  const j = await res.json()
  const text = Buffer.from(j.content ?? '', 'base64').toString('utf8')
  return { sha: j.sha, text }
}

/** 从 manifest 补全记忆文件清单。 */
function discoverFiles() {
  const files = [...STRUCTURAL_FILES]
  if (existsSync(join(ROOT, 'manifest.json'))) {
    try {
      const m = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'))
      for (const g of ['docs', 'memories']) {
        for (const e of m[g] ?? []) if (typeof e?.file === 'string') files.push(e.file)
      }
    } catch {
      /* manifest 坏了就只推结构性文件；verify.mjs 会另外报错 */
    }
  }
  return [...new Set(files)]
}

// ── 参数 ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const only = args.filter((a) => !a.startsWith('-'))
const msgIdx = args.findIndex((a) => a === '-m' || a === '--message')
const customMessage = msgIdx >= 0 ? args[msgIdx + 1] : undefined
// -m 后面的值不算作「只推这个文件」
if (customMessage !== undefined) only.splice(only.indexOf(customMessage), 1)

// ── 主流程 ──────────────────────────────────────────────────────────────────

const files = (only.length > 0 ? only : discoverFiles()).filter((f) => existsSync(join(ROOT, f)))

if (files.length === 0) {
  console.log('没有可推送的文件。')
  process.exit(0)
}

console.log(`目标：${OWNER}/${REPO}@${BRANCH}`)
console.log(`检查 ${files.length} 个文件…\n`)

const toPush = []
for (const path of files) {
  const local = readFileSync(join(ROOT, path), 'utf8')
  let remote
  try {
    remote = await remoteFile(path)
  } catch (err) {
    console.log(`  ⚠️  ${path} — 无法比对远程（${err.message}），将尝试推送`)
    toPush.push({ path, local, sha: undefined })
    continue
  }

  if (remote !== undefined && norm(remote.text) === norm(local)) {
    console.log(`  ✅ 无变化   ${path}`)
    continue
  }
  console.log(`  ${remote === undefined ? '➕ 新增    ' : '📤 待推送  '} ${path}`)
  toPush.push({ path, local, sha: remote?.sha })
}

if (toPush.length === 0) {
  console.log('\n✅ 本地与远程完全一致，无需推送。')
  process.exit(0)
}

if (dryRun) {
  console.log(`\n（--dry-run：以上 ${toPush.length} 个文件会被推送，但未实际提交。）`)
  process.exit(0)
}

// Contents API 一次只能提交一个文件；用同一个提交信息依次推送。
const message =
  customMessage ??
  `chore: 同步 ${toPush.length} 个文件（${toPush.map((f) => f.path).join(', ')}）`

let pushed = 0
for (const f of toPush) {
  const body = {
    message,
    content: Buffer.from(f.local, 'utf8').toString('base64'),
    branch: BRANCH,
    ...(f.sha !== undefined ? { sha: f.sha } : {}),
  }
  const res = await fetch(`${API}/contents/${encodeURIComponent(f.path)}`, {
    method: 'PUT',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    console.log(`  ❌ 推送失败 ${f.path} — HTTP ${res.status} ${t.slice(0, 160)}`)
    continue
  }
  const j = await res.json()
  console.log(`  ✅ 已推送   ${f.path}  → ${j.commit?.sha?.slice(0, 7) ?? '?'}`)
  pushed++
}

console.log(`\n${'─'.repeat(56)}`)
console.log(`成功推送 ${pushed}/${toPush.length} 个文件`)

if (pushed < toPush.length) {
  console.log('\n⚠️ 有文件推送失败，请重试。')
  process.exitCode = 2
} else {
  console.log('\n✅ 推送完成。现在跑 `node sync.mjs` 把远程拉回本地，确保两边一致。')
}

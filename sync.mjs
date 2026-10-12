#!/usr/bin/env node
/**
 * 把远程仓库同步到本地 —— 替代 git pull。
 *
 * 为什么需要它：本机**没有 git**（PATH 与常见安装位置都没有），
 * 所以 SPEC 里教的 `git pull` 在这台机器上根本无法执行。
 * 结果是：远程 push 了 → 本地永不更新 → 而 `~/.dsh/AGENTS.md` 是指向本地的
 * 软链接 → **注入给 agent 的永远是旧记忆**。
 *
 * 这个脚本用 GitHub 的 raw 端点补上“拉取”这一环，闭合记忆库的自我更新。
 *
 * 用法:
 *   node sync.mjs             # 拉取并覆盖本地
 *   node sync.mjs --dry-run   # 只看差异，不写
 *   node sync.mjs --check     # 有差异则退出码 1（供校验器使用）
 *
 * 零依赖，需要 Node 18+。
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const OWNER = 'HypoDear'
const REPO = 'dsh-memory'
const BRANCH = 'main'
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}`

/**
 * 仓库里**永远存在**的固定文件。
 *
 * ⚠️ 这里刻意只放“结构性”文件 —— 记忆正文**不写死**。
 *    早先版本把记忆文件硬编码在这个列表里，结果新增记忆后本地永远同步不到，
 *    而脚本还报“成功”。记忆文件改为从 manifest.json 动态发现（见 discoverFiles）。
 */
const STRUCTURAL_FILES = [
  'AGENTS.md',
  'README.md',
  'SPEC.md',
  'manifest.json',
  'index.html',
  'sync.mjs',
  'verify.mjs',
  'memory/README.md',
  'memory/_template.md',
]

// ── 工具 ────────────────────────────────────────────────────────────────────

/** 本地仓库根目录：默认脚本所在目录。 */
const ROOT = import.meta.dirname ?? process.cwd()

const norm = (s) => s.replace(/\r\n/g, '\n').trim()

/**
 * 取 main 的当前 commit sha。
 *
 * ⚠️ 必须 pin 到 commit 再读：raw CDN 会缓存，直接读 `main` 有可能拿到**旧内容**
 *    （已被实测证实：`memory/README.md` 曾返回过期版本）。
 */
/**
 * 请求头，尽量带上 token。
 *
 * ⚠️ 认证很重要：匿名调 GitHub API 每小时只有 **60 次**
 *    （实测本机曾降到 7 次），反复同步很容易被限流成 HTTP 403。
 *    带 token 的额度是 **5000/小时**。
 *    token 只进请求头，**绝不写入仓库、绝不打印**。
 */
function authHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-memory-sync',
  }
  for (const name of ['MCP_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) {
    const v = process.env[name]
    if (typeof v === 'string' && v.trim() !== '') {
      headers.Authorization = `Bearer ${v.trim()}`
      break
    }
  }
  return headers
}

/**
 * 取 main 的当前 commit sha。
 *
 * ⚠️ 必须 pin 到 commit 再读：raw CDN 会缓存，直接读 `main` 有可能拿到**旧内容**
 *    （已被实测证实：`memory/README.md` 曾返回过期版本）。
 */
async function currentCommitSha() {
  const headers = authHeaders()
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`, {
    headers,
    cache: 'no-store',
  })

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    const resetAt = Number(res.headers.get('x-ratelimit-reset') ?? 0)
    const mins = resetAt > 0 ? Math.ceil((resetAt * 1000 - Date.now()) / 60000) : 0
    throw new Error(
      `GitHub API 限流（HTTP ${res.status}${remaining !== null ? `，剩余 ${remaining}` : ''}）。` +
        (headers.Authorization
          ? '已带 token 仍被限流，请稍后重试。'
          : '未检测到 token —— 匿名额度只有 60 次/小时。请设置 MCP_GITHUB_TOKEN 后重试。') +
        (mins > 0 ? ` 约 ${mins} 分钟后重置。` : ''),
    )
  }
  if (!res.ok) throw new Error(`取 commit sha 失败：HTTP ${res.status}`)
  const j = await res.json()
  const sha = j?.sha
  if (typeof sha !== 'string' || sha.length < 7) throw new Error('响应里没有 commit sha')
  return sha
}

/**
 * 拉一个文件。
 *
 * 走 raw 端点（不计入 API 限流），token 一并带上 —— 仓库若将来改回私有也仍可读。
 */
async function fetchFile(sha, path) {
  const res = await fetch(`${RAW}/${sha}/${path}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

/**
 * 从远程 manifest.json 发现记忆文件。
 *
 * 这是**动态**的：新增记忆只需更新 manifest，同步脚本不用改。
 * manifest 是记忆清单的单一真相源 —— 网页阅读器也读它。
 */
async function discoverFiles(sha) {
  const text = await fetchFile(sha, 'manifest.json')
  let doc
  try {
    doc = JSON.parse(text)
  } catch (err) {
    throw new Error(`远程 manifest.json 不是合法 JSON：${err.message}`)
  }
  const fromManifest = []
  for (const group of ['docs', 'memories']) {
    for (const entry of doc[group] ?? []) {
      if (typeof entry?.file === 'string' && entry.file !== '') fromManifest.push(entry.file)
    }
  }
  return [...new Set([...STRUCTURAL_FILES, ...fromManifest])]
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const checkOnly = args.includes('--check')

const sha = await currentCommitSha()
console.log(`远程 ${OWNER}/${REPO}@${BRANCH} 当前 commit: ${sha.slice(0, 10)}`)
console.log(`本地根目录: ${ROOT}\n`)

let FILES
try {
  FILES = await discoverFiles(sha)
} catch (err) {
  console.error(`❌ 无法发现文件清单：${err.message}`)
  process.exit(2)
}
console.log(`待同步 ${FILES.length} 个文件（结构 ${STRUCTURAL_FILES.length} + manifest 发现）\n`)

const results = { same: [], updated: [], created: [], failed: [], backedUp: [] }

/**
 * 备份目录：本次运行中被覆盖的文件先存一份。
 *
 * ⚠️ 这是踩过坑之后加的。原先直接 `writeFileSync` 覆盖 ——
 *    如果本地有**尚未推送**的编辑，会被远程版本**静默抹掉**，无从恢复。
 *    现在每次覆盖前先把本地原文存进 `.backup/<时间戳>/`。
 */
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const BACKUP_DIR = join(ROOT, '.backup', stamp)

for (const path of FILES) {
  const local = join(ROOT, path)
  try {
    const remoteText = await fetchFile(sha, path)
    const exists = existsSync(local)
    const localText = exists ? readFileSync(local, 'utf8') : null

    if (exists && norm(localText) === norm(remoteText)) {
      results.same.push(path)
      console.log(`  ✅ 已一致   ${path}`)
      continue
    }

    if (checkOnly || dryRun) {
      console.log(`  ${exists ? '⚠️  有差异' : '➕ 本地缺失'} ${path}`)
      ;(exists ? results.updated : results.created).push(path)
      if (exists) {
        const l = norm(localText).split('\n')
        const r = norm(remoteText).split('\n')
        console.log(`       本地 ${l.length} 行 / 远程 ${r.length} 行`)
      }
      continue
    }

    // 覆盖前备份本地原文（新增文件无需备份）
    if (exists) {
      const dest = join(BACKUP_DIR, path)
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, localText, 'utf8')
      results.backedUp.push(path)
    }

    mkdirSync(dirname(local), { recursive: true })
    writeFileSync(local, remoteText, 'utf8')
    ;(exists ? results.updated : results.created).push(path)
    console.log(`  ${exists ? '🔄 已更新  ' : '➕ 已创建  '} ${path}`)
  } catch (err) {
    results.failed.push(path)
    console.log(`  ❌ 失败     ${path} — ${err.message}`)
  }
}

// ── 汇总 ────────────────────────────────────────────────────────────────────

const changed = results.updated.length + results.created.length
console.log(`\n${'─'.repeat(56)}`)
console.log(`一致 ${results.same.length} · 更新 ${results.updated.length} · 新建 ${results.created.length} · 失败 ${results.failed.length}`)

if (results.failed.length > 0) {
  console.log('\n⚠️ 有文件拉取失败 —— 本地可能仍是不完整状态，请重跑。')
  process.exitCode = 2
} else if (changed === 0) {
  console.log('\n✅ 本地与远程完全一致，注入的记忆就是最新的。')
} else if (dryRun) {
  console.log('\n（--dry-run：未写入任何文件。去掉该参数即执行同步。）')
} else {
  console.log('\n✅ 同步完成。')
  if (results.backedUp.length > 0) {
    console.log(`   被覆盖的 ${results.backedUp.length} 个本地版本已备份到：`)
    console.log(`   ${BACKUP_DIR}`)
    console.log('   ⚠️ 若你刚才有**尚未推送**的本地编辑，它们已被远程版本取代 ——')
    console.log('      请到上面的备份目录取回，然后用推送工具提交，而不是只改本地。')
  }
  console.log('   注意：`~/.dsh/AGENTS.md` 是软链接，已自动指向新内容；')
  console.log('   但**已在进行中的会话不会重新注入** —— 新开会话才能读到最新记忆。')
}

// --check：有差异就以 1 退出，便于接进校验流程
if (checkOnly && changed > 0) process.exitCode = 1

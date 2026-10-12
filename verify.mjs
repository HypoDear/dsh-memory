#!/usr/bin/env node
/**
 * 记忆库一致性校验器。
 *
 * 为什么需要它：入口索引、memory/README.md 清单、manifest.json 三处需要手工同步，
 * 没有任何自动检查 —— 实测在只有 2 个记忆文件的规模就已经出现不一致
 * （README 漏列自己、摘要三种写法、锚点两套规则并存）。
 *
 * 这个脚本把「靠人记性」换成「机器检查」。
 *
 * 用法:
 *   node verify.mjs        # 校验，有问题退出码 1
 *
 * 零依赖。只读，不修改任何文件。
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

const ROOT = import.meta.dirname ?? process.cwd()

const problems = []
const warnings = []
const fail = (msg) => problems.push(msg)
const warn = (msg) => warnings.push(msg)

const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const has = (p) => existsSync(join(ROOT, p))

/**
 * 与 index.html 的 slug() 保持一致的锚点算法（对齐 GitHub github-slugger）：
 * 转小写 → 删除标点与符号（但保留 - 和 _）→ 空白转 -
 */
const slug = (s) => s
  .toLowerCase()
  .trim()
  .replace(/[\p{P}\p{S}]/gu, (m) => (m === '-' || m === '_' ? m : ''))
  .replace(/\s+/g, '-')

/** 抽出 markdown 里所有标题（用于算锚点）。 */
function headings(md) {
  return [...md.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) => slug(m[1]))
}

// ── 1. manifest.json 合法性 ─────────────────────────────────────────────────

let manifest
try {
  manifest = JSON.parse(read('manifest.json'))
} catch (err) {
  fail(`manifest.json 不是合法 JSON：${err.message}`)
  manifest = null
}

// ── 2. 每个 manifest 条目：文件存在 + 链接可解析 ─────────────────────────────

const manifestFiles = []
if (manifest) {
  for (const group of ['docs', 'memories']) {
    if (!Array.isArray(manifest[group])) {
      fail(`manifest.json 缺少 ${group} 数组`)
      continue
    }
    for (const entry of manifest[group]) {
      if (typeof entry.file !== 'string') {
        fail(`manifest.${group} 有条目缺 file 字段`)
        continue
      }
      manifestFiles.push(entry.file)
      if (!has(entry.file)) fail(`manifest 引用的文件不存在：${entry.file}`)
      for (const k of ['slug', 'title', 'summary']) {
        if (typeof entry[k] !== 'string' || entry[k] === '') {
          fail(`manifest 条目 ${entry.file} 缺 ${k}`)
        }
      }
    }
  }
  // slug 唯一性
  const slugs = ['docs', 'memories'].flatMap((g) => (manifest[g] ?? []).map((e) => e.slug))
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i)
  if (dup.length) fail(`manifest 有重复 slug：${[...new Set(dup)].join(', ')}`)
  if (typeof manifest.updated !== 'string') warn('manifest.json 缺 updated 字段')
}

// ── 3. 所有 markdown 的相对链接与锚点 ───────────────────────────────────────

const mdFiles = [
  'AGENTS.md',
  'README.md',
  'SPEC.md',
  ...(manifest?.memories ?? []).map((m) => m.file).filter((f) => f.endsWith('.md')),
  'memory/README.md',
  'memory/_template.md',
].filter((f, i, a) => a.indexOf(f) === i && has(f))

const headingCache = new Map()
const headingsOf = (p) => {
  if (!headingCache.has(p)) headingCache.set(p, headings(read(p)))
  return headingCache.get(p)
}

let linkCount = 0
for (const src of mdFiles) {
  const text = read(src)
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const [, , href] = m
    if (/^https?:|^mailto:/.test(href)) continue
    linkCount++

    const [rawPath, anchor] = href.split('#')
    const target = rawPath === '' ? src : join(dirname(src), rawPath)

    // 路径存在性
    if (rawPath !== '' && !has(target)) {
      // 指向「计划中」的文件允许，但必须显式标注
      const isPlanned = /待写|计划/.test(text)
      if (isPlanned) warn(`${src}: 链接指向尚未落库的文件（已标注“待写”）：${href}`)
      else fail(`${src}: 断链 → ${href}`)
      continue
    }

    // 锚点存在性
    if (anchor !== undefined && anchor !== '') {
      const targetFile = rawPath === '' ? src : target
      if (!targetFile.endsWith('.md')) continue
      const ids = headingsOf(targetFile)
      if (!ids.includes(anchor)) {
        const near = ids.filter(
          (id) => id.includes(anchor.replace(/^[一二三四五六七八九十]、?/, '')) || anchor.includes(id),
        )
        fail(
          `${src}: 锚点不存在 → ${href}` +
            (near.length ? `（你是想指 ${near.map((n) => '#' + n).join(' 或 ')}？）` : ''),
        )
      }
    }
  }
}

// ── 4. 索引一致性：AGENTS.md 与 memory/README.md 是否覆盖同一批文件 ──────────

const realMemories = mdFiles
  .filter((f) => f.startsWith('memory/'))
  .filter((f) => !['memory/README.md', 'memory/_template.md'].includes(f))
  .map((f) => basename(f))

const agentsText = has('AGENTS.md') ? read('AGENTS.md') : ''
const memReadme = has('memory/README.md') ? read('memory/README.md') : ''

for (const file of realMemories) {
  if (!agentsText.includes(file)) fail(`AGENTS.md 索引漏掉了记忆文件：${file}`)
  if (!memReadme.includes(file)) fail(`memory/README.md 清单漏掉了记忆文件：${file}`)
}

// 反向：索引里提到但文件不存在
for (const [, ref] of agentsText.matchAll(/\(\.\/memory\/([a-z0-9-]+\.md)\)/g)) {
  if (!has(`memory/${ref}`)) fail(`AGENTS.md 索引指向不存在的文件：memory/${ref}`)
}

// ── 5. index.html 的 slug 算法是否与校验器一致 ──────────────────────────────

if (has('index.html')) {
  const html = read('index.html')
  if (!html.includes('\\p{P}\\p{S}')) {
    warn('index.html 的 slug() 似乎未采用「删除标点」的规则，可能与 GitHub 锚点不一致')
  }
  if (!html.includes('rel="icon"')) warn('index.html 缺 favicon')
}

// ── 6. 同步与备份基础设施 ────────────────────────────────────────────────────

if (!has('sync.mjs')) warn('缺少 sync.mjs —— 本机无 git 时无法拉取远程更新')
if (has('sync.mjs') && !read('sync.mjs').includes('BACKUP_DIR')) {
  warn('sync.mjs 未见备份逻辑 —— 覆盖本地前应备份')
}
if (!has('.gitignore')) warn('缺 .gitignore —— .backup/ 可能被误提交')

// ── 报告 ────────────────────────────────────────────────────────────────────

console.log(
  `校验范围：${mdFiles.length} 个 markdown · ${linkCount} 个站内链接 · ${manifestFiles.length} 个 manifest 条目\n`,
)

if (warnings.length) {
  console.log(`⚠️  警告 ${warnings.length} 条：`)
  for (const w of warnings) console.log(`   · ${w}`)
  console.log()
}

if (problems.length) {
  console.log(`❌ 问题 ${problems.length} 条：`)
  for (const p of problems) console.log(`   · ${p}`)
  console.log('\n校验未通过。')
  process.exitCode = 1
} else {
  console.log('✅ 校验通过：文件齐备、链接有效、锚点存在、索引一致。')
}

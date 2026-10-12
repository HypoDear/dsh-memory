# memory/ — 记忆正文

本目录存放实际的记忆内容，每个文件一个主题。

**格式规范**见 [`../SPEC.md`](../SPEC.md#三记忆文件格式)。**新建文件请复制 [`_template.md`](./_template.md)。**

---

## 现有记忆

| 文件 | 主题 |
|---|---|
| [`_template.md`](./_template.md) | 格式模板（不是记忆本身） |

> 目前只有模板。正文待写 —— 见下面的待写清单。

---

## 待写清单

以下主题已经过验证、值得记录，但**尚未落库**。按规范，每条写入前需与用户确认。

| 计划文件 | 主题 | 来源 |
|---|---|---|
| `dsh-bundle-patch.md` | bundle patch 的 `insert:` 陷阱（新增条目被静默丢弃） | 两台 MCP 都不出现的根因 |
| `dsh-session-management.md` | 会话存储结构与正确删除方式（3 处） | 删除会话时整理 |
| `local-environment.md` | 本机环境事实（无 git、pwsh 路径、Python/Node 位置） | 多次排查得出 |
| `windows-scripting.md` | Windows 脚本的坑（codepage、回收站、路径） | `.cmd` 乱码事故 |

---

## 写法提醒

1. **先结论后细节** —— 别让人读到最后才知道重点
2. **写验证方式** —— 环境会变，没有验证方式的记忆会腐烂
3. **不要写密钥和隐私**
4. **写完更新 [`manifest.json`](../manifest.json)** —— 否则网页上看不到

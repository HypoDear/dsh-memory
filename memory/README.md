# memory/ — 记忆正文

本目录存放实际的记忆内容，每个文件一个主题。

**格式规范**见 [`../SPEC.md`](../SPEC.md#三记忆文件格式)。**新建文件请复制 [`_template.md`](./_template.md)。**

---

## 现有记忆

| 文件 | 主题 |
|---|---|
| [`workbuddy-integration.md`](./workbuddy-integration.md) | WorkBuddy 接入：凭据、端点、签到、令牌寿命 |
| [`windows-scripting.md`](./windows-scripting.md) | Windows 脚本坑：cmd 编码、URL 截断、软链接验证、引号陷阱 |
| [`README.md`](./README.md) | 本文件（目录说明，不是记忆本身） |
| [`_template.md`](./_template.md) | 格式模板（不是记忆本身） |

---

## 待写清单

以下主题已验证、值得记录，但**尚未落库**。写入前需与用户确认。

| 计划文件 | 主题 | 状态 |
|---|---|---|
| `dsh-bundle-patch.md` | bundle patch 的 `insert:` 陷阱 | 待确认 |
| `dsh-session-management.md` | 会话存储结构与正确删除方式（3 处） | 待确认 |

> 已评估后*不*记录：本机环境事实（变化太快，验证成本高于收益）。

---

## 写法提醒

1. **先结论后细节** —— 别让人读到最后才知道重点
2. **写验证方式** —— 环境会变，没有验证方式的记忆会腐烂
3. **不要写密钥和隐私**
4. **写完更新 [`manifest.json`](../manifest.json)，并跑 `node verify.mjs` 自检**

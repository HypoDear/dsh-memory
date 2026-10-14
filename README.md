# dsh-memory

DeepSeek Harness 的**长期记忆库** —— 把开发经验、环境事实、踩过的坑集中放在一处，供 AI agent 在新会话中读取，也供人随时查阅。

- 📖 **在线阅读**：https://hypodear.github.io/dsh-memory/
- 🤖 **Agent 入口**：[AGENTS.md](./AGENTS.md)
- 📐 **写入规范**：[SPEC.md](./SPEC.md)

---

## 这是什么

AI agent 默认**没有跨会话记忆** —— 每次新会话都是空白。这个仓库用纯 Markdown 补上这一环：

```
~/.dsh/AGENTS.md          ← 本机指针（只写「去哪读」，几乎不变）
        ↓
   本仓库 AGENTS.md         ← 记忆入口（第一层）
        ↓
   本仓库 memory/*.md       ← 记忆正文（第二层）
        ↓
   index.html (Pages)      ← 人可读的浏览界面
```

**远端是唯一真相源。** 本机不保存正文，所以不存在「本地副本忘了拉取」这个故障 ——
这是本库最重要的设计决定，理由见 [SPEC.md](./SPEC.md#八设计演变为什么放弃了本地副本)。

## 目录结构

| 路径 | 作用 |
|---|---|
| `AGENTS.md` | 记忆入口。短、高价值、每次会话都会被注入 |
| `SPEC.md` | 记忆文件的规范：命名、格式、写入流程、读取方式 |
| `manifest.json` | 网页阅读器的目录清单 |
| `index.html` | 单文件阅读器（GitHub Pages 提供） |
| `memory/` | 记忆正文，按主题分文件 |

## 怎么用

**作为 AI 记忆**：在本机 `~/.dsh/AGENTS.md` 放一份指针，DSH 每次会话会自动注入它。
指针内容与读取方式见 [SPEC.md](./SPEC.md#五读取路径)。

**本机指针全文（备份）** —— 新设备接入时，把下面这段原样复制到 `~/.dsh/AGENTS.md` 即可。
指针几乎不变；若日后有改动，请回来同步更新这一段：

````markdown
# 长期记忆（指针）

本机**不再保存记忆正文**。长期记忆只有一份，在 GitHub：

    https://github.com/HypoDear/dsh-memory

**每次会话开始时，用 `read_mcp_resource` 读取它：**

```
read_mcp_resource(
  server="github",
  uri="repo://HypoDear/dsh-memory/contents/AGENTS.md")
```

然后按该文件里的索引继续读 `memory/*.md`，把路径接到 `contents/` 后面。

⚠️ **不要用 `get_file_contents`** —— 它返回的是「嵌入式资源块」，
DSH 不把该块投影给模型，你只会看到一句
`[embedded resource unsupported; raw resource data remains available to programmatic callers]`，
**正文一个字都读不到**（调用却显示成功）。详见仓库 `SPEC.md` 第五节。

备用：MCP 未挂载时用 `web_fetch` 取
`https://raw.githubusercontent.com/HypoDear/dsh-memory/main/AGENTS.md`

## 两条永久规则（不随记忆库变动）

1. **写入记忆前必须先向用户确认**，不允许静默写入。
2. **该仓库是公开的** —— 绝不写入密钥、令牌、密码、个人隐私。

---
*本文件是稳定指针，几乎不需要修改；记忆内容全部在仓库里。*
````

**改了记忆之后**：**没有后续步骤** —— 用 GitHub MCP 写入即发布。
本机没有 git、没有副本、没有同步脚本。

**作为个人参考**：直接看 Pages 站点。

## 写入原则

> **任何写入都必须先与用户确认。**

细节见 [SPEC.md](./SPEC.md)。核心三条：

1. **先确认再写** —— agent 提出内容，用户确认后才落库
2. **只写可复用的事实** —— 不写一次性对话、不写密钥、不写隐私
3. **短而准** —— 入口文件保持精简，细节下沉到 `memory/`

## 许可

个人记忆库。

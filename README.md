# dsh-memory

DeepSeek Harness 的**长期记忆库** —— 把开发经验、环境事实、踩过的坑集中放在一处，供 AI agent 在新会话中读取，也供人随时查阅。

- 📖 **在线阅读**：启用 GitHub Pages 后见仓库设置
- 🤖 **Agent 入口**：[AGENTS.md](./AGENTS.md)
- 📐 **写入规范**：[SPEC.md](./SPEC.md)

---

## 这是什么

AI agent 默认**没有跨会话记忆** —— 每次新会话都是空白。这个仓库用纯 Markdown 补上这一环：

```
~/.dsh/AGENTS.md          ← 本机入口（指向本仓库）
        ↓
   本仓库 memory/*.md      ← 真正的记忆内容
        ↓
   index.html (Pages)      ← 人可读的浏览界面
```

同时它便于：

- 在任何设备上 `git clone` 得到同一份记忆
- 用浏览器直接查看（无需装任何东西）
- 用 Git 历史回溯每条经验是什么时候、为什么加的

## 目录结构

| 路径 | 作用 |
|---|---|
| `AGENTS.md` | 记忆入口。短、高价值、每次会话都会被注入 |
| `SPEC.md` | 记忆文件的规范：命名、格式、写入流程 |
| `manifest.json` | 网页阅读器的目录清单 |
| `index.html` | 单文件阅读器（GitHub Pages 提供） |
| `memory/` | 记忆正文，按主题分文件 |

## 怎么用

```bash
git clone https://github.com/HypoDear/dsh-memory.git
```

**作为 AI 记忆**：把本机的 `~/.dsh/AGENTS.md` 指向本仓库（软链接或复制），详见 [SPEC.md](./SPEC.md#五本机接入)。

**改了记忆之后**：本机没有 git，必须跑 `node sync.mjs` 把远程拉回本地，否则注入的仍是旧版。
`node verify.mjs` 可自检一致性。

**作为个人参考**：直接看 Pages 站点。

## 写入原则

> **任何写入都必须先与用户确认。**

细节见 [SPEC.md](./SPEC.md)。核心三条：

1. **先确认再写** —— agent 提出内容，用户确认后才落库
2. **只写可复用的事实** —— 不写一次性对话、不写密钥、不写隐私
3. **短而准** —— 入口文件保持精简，细节下沉到 `memory/`

## 许可

个人记忆库。

# dsh-memory

DeepSeek Harness 的**长期记忆库**：把反复踩的坑、环境事实和决定放在一处，
供 agent 每次会话读取，也供人查阅。

- 📖 在线阅读：<https://hypodear.github.io/dsh-memory/>
- 🤖 Agent 入口：[AGENTS.md](./AGENTS.md)
- 📐 规范：[SPEC.md](./SPEC.md)

## 结构

| 路径 | 作用 |
|---|---|
| `AGENTS.md` | 记忆入口：铁律 + 索引（每次会话自动注入） |
| `SPEC.md` | 格式与流程 |
| `memory/*.md` | 记忆正文 |
| `manifest.json` / `index.html` | 网页阅读器 |

## 怎么用

**Agent**：本机 `~/.dsh/AGENTS.md` 放一份极小指针（只写「去 GitHub 读」），DSH 每次会话注入它。
新设备接入时把指针复制过去即可 —— 指针内容各设备一致，几乎不变。

**人**：直接看上面的在线阅读链接。

**写入**：**必须用户确认后**才写，格式见 `SPEC.md`。远端是唯一真相源，本机没有副本，
写入即发布，没有任何同步步骤。

## 许可

个人记忆库。
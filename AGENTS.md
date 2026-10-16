# AGENTS.md — 记忆入口

> 本文件每次会话都会被注入。**只留铁律和索引**，细节在 `memory/`。

## 一、怎么读

```
read_mcp_resource(server="github",
                  uri="repo://HypoDear/dsh-memory/contents/AGENTS.md")
```

⚠️ **不要用 `get_file_contents`** —— 它返回「嵌入式资源块」，DSH 不投影给模型，
正文一个字都读不到（调用却显示成功）。MCP 未挂载时的备用：`web_fetch` 取
`https://raw.githubusercontent.com/HypoDear/dsh-memory/main/AGENTS.md`。

## 二、怎么写

**任何写入前先向用户确认**；格式照 [`memory/_template.md`](./memory/_template.md)；
改完同步 **2 处**：本文件索引、[`manifest.json`](./manifest.json)。
**写入即发布** —— 远端是唯一真相源，本机没有副本，没有同步步骤。

## 三、铁律

### 环境
- **本机没有 `git`** —— 需要操作 GitHub 就用 GitHub MCP 工具。
- **改完用户级环境变量必须重启 DSH**，运行中的进程读不到改动。
- `pwsh` 可用；退出码 `3221225794` = `STATUS_DLL_INIT_FAILED`，先查 PATH 第一项。

### DSH 配置
- **bundle patch 新增条目必须包在 `- insert:` 里**，裸顶层 `- id:` 匹配不到会**静默丢弃**。
- **profile patch 是整块替换，不是深合并** —— 覆盖某条目要重述所有想保留的字段。
- **`.cmd` 必须纯 ASCII**（cmd.exe 按 GBK 读），逻辑写进 `.mjs`。

### 删除类操作
- **优先送回收站**，不要直接删。
- 删会话要同时清 **3 处**：会话目录、`session_projcache`、`workspace.json` 的 `sessionIds`。
- **删文件前确认没有 `link:` 软链接依赖它** —— 源被删后表面正常，直到下次重启才暴露。

### 本仓库
- ⚠️ **公开仓库**：绝不写入密钥、令牌、密码、个人隐私（姓名/电话/邮箱/账号 id）。
- 只记**关键节点和指导方向**，不记探索过程。

## 四、索引

| 文件 | 一句话 |
|---|---|
| [`memory/dsh-mcp.md`](./memory/dsh-mcp.md) | 接 MCP 用官方 `dsh-mcp-client` 行；新增行必须 `- insert:` |
| [`memory/dsh-workbuddy-connect.md`](./memory/dsh-workbuddy-connect.md) | WorkBuddy 接 DSH：凭据顺序、端点、固定档位、可见性、签到 |
| [`memory/dsh-remote.md`](./memory/dsh-remote.md) | 手机遥控桌面 DSH：link 安装、`wire.js` 重建、配对状态 |
| [`memory/windows.md`](./memory/windows.md) | Windows 脚本四坑：cmd 编码、URL 的 `&`、软链接验证、引号 |
| [`memory/windows-tweaks.md`](./memory/windows-tweaks.md) | 系统调优：暂停更新上限、Win10 右键菜单、卓越性能方案 |
| [`SPEC.md`](./SPEC.md) | 记忆格式与流程 |

`~/.dsh/AGENTS.md` 是各设备一致的**极小指针**，只写「去哪读」，几乎不变。

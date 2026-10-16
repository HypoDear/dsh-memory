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
- **本机只用 `dsh web`**（`DSH_PROFILE=web`），桌面端已卸载 —— 命令一律 `--profile web`。
- **本机没有 `git`** —— 需要操作 GitHub 就用 GitHub MCP 工具。
- **改完用户级环境变量必须重启 DSH**，运行中的进程读不到改动。
- `pwsh` 可用；退出码 `3221225794` = `STATUS_DLL_INIT_FAILED`，先查 PATH 第一项。

### DSH 配置
- **bundle patch 新增条目必须包在 `- insert:` 里**，裸顶层 `- id:` 匹配不到会**静默丢弃**。
- **profile patch 是整块替换，不是深合并** —— 覆盖某条目要重述所有想保留的字段。
- **`.cmd` 必须纯 ASCII**（cmd.exe 按 GBK 读），逻辑写进 `.mjs`。
- **改配置要不要重启，看写在哪一层**：home/profile 层 patch 被 `dsh-hmr` 监视、**热生效**；
  bundle 自带 patch 与插件 JS 源码**不被监视、必须重启**。详见
  [`memory/dsh-mcp.md`](./memory/dsh-mcp.md)。
- **把 bundle 里的行搬到 home/profile 层时，必须换 `id`** —— 沿用同名 id 会让插件页
  判定 `bundle-in-use`，导致那个 bundle **永远卸不掉**（重启无用）。
  详见 [`memory/dsh-plugin-id-clash.md`](./memory/dsh-plugin-id-clash.md)。

### 删除类操作
- **优先送回收站**，不要直接删。
- 删会话要同时清 **3 处**：会话目录、`session_projcache`、`workspace.json` 的 `sessionIds`。
- **删文件前确认没有 `link:` 软链接依赖它** —— 源被删后表面正常，直到下次重启才暴露。
- 删软链后**回头确认源目录仍在**（删链接不应伤及目标）。

### 本仓库
- ⚠️ **公开仓库**：绝不写入密钥、令牌、密码、个人隐私（姓名/电话/邮箱/账号 id）。
- 只记**关键节点和指导方向**，不记探索过程。

## 四、索引

| 文件 | 一句话 |
|---|---|
| [`memory/dsh-environment.md`](./memory/dsh-environment.md) | 本机只用 web 端；插件目标一律 `--profile web` |
| [`memory/dsh-mcp.md`](./memory/dsh-mcp.md) | MCP 装载五种形式；哪层改动热生效、哪层要重启 |
| [`memory/dsh-plugin-id-clash.md`](./memory/dsh-plugin-id-clash.md) | 行 id 与 bundle 撞车 → 那个 bundle 永远卸不掉 |
| [`memory/dsh-restart.md`](./memory/dsh-restart.md) | 会话内重启 DSH 必失败：aux 进程与 DSH 同生共死 |
| [`memory/dsh-autostart.md`](./memory/dsh-autostart.md) | Web 端自启：计划任务登录触发；三个必须覆盖的默认值 |
| [`memory/dsh-workbuddy-connect.md`](./memory/dsh-workbuddy-connect.md) | WorkBuddy 接 DSH：凭据顺序、端点、固定档位、可见性、签到 |
| [`memory/dsh-remote.md`](./memory/dsh-remote.md) | 手机遥控 DSH：link 安装、`wire.js` 重建、配对状态 |
| [`memory/windows.md`](./memory/windows.md) | Windows 脚本四坑：cmd 编码、URL 的 `&`、软链接验证、引号 |
| [`memory/windows-tweaks.md`](./memory/windows-tweaks.md) | 系统调优：暂停更新上限、Win10 右键菜单、卓越性能方案 |
| [`SPEC.md`](./SPEC.md) | 记忆格式与流程 |

`~/.dsh/AGENTS.md` 是各设备一致的**极小指针**，只写「去哪读」，几乎不变。

# DSH Web 自启：交给计划任务，不用终端

- **标签**：`dsh` `autostart` `windows` `taskscheduler`
- **更新**：2026-10-16
- **状态**：有效

## 结论

- DSH **没有**自启 / 服务 / 托盘子命令。要「开机即用」只能交给系统层托管。
- **用「任务计划程序 · 登录触发 · 当前用户交互式（Interactive）」**。
  **不要**用 Windows 服务，**不要**用 `.vbs`（本机 VBScript 引擎已移除）。
- 守卫脚本必须自己解决三件事：**防重复启动**、**输出落日志**、**退出码透传**。
- 脚本与说明落在 `$env:USERPROFILE\.dsh\autostart\`：
  `start-dsh-web.ps1`（守卫+启动）、`open-dsh.ps1`（一键打开）、
  `register-dsh-autostart.ps1` / `unregister-dsh-autostart.ps1`。

## 细节

### 为什么是计划任务

| 方案 | 结论 |
|---|---|
| 计划任务（登录触发，Interactive） | **采用** |
| 启动文件夹快捷方式 | 可作兜底，但无去重、无重试 |
| Windows 服务（WinSW / NSSM） | ❌ 跑在 session 0：读不到用户级环境变量，且无法把浏览器开到用户桌面 |
| `.vbs` 隐藏启动 | ❌ 本机 VBScript 引擎已被移除 |
| 从 DSH 会话内重启 DSH | ❌ 结构性不可行，见 [`dsh-restart.md`](./dsh-restart.md) |

### 必须显式覆盖的三个危险默认值

| 项 | 默认 | 设为 | 不设的后果 |
|---|---|---|---|
| `ExecutionTimeLimit` | `PT72H` | `PT0S` | dsh 连跑 3 天被强杀 |
| `DisallowStartIfOnBatteries` | `True` | `False` | 电池供电时任务直接不启动 |
| `StopIfGoingOnBatteries` | `True` | `False` | 一拔电源就被掐断 |

再加 `MultipleInstances=IgnoreNew`（防重复）、`LogonType=Interactive`（会话内）、
`RestartCount/RestartInterval`（崩溃重拉）。

### 登录触发器用 Delay，不是 RandomDelay

`New-ScheduledTaskTrigger -AtLogOn -RandomDelay` 会被**接受但静默丢弃** ——
命令回显正常、无警告，导出的 XML 里却根本没有延迟元素。

```powershell
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
$trigger.Delay = 'PT15S'
```

**注册后必须 `Export-ScheduledTask` 核对 XML**，不能只看命令回显。

### 守卫的进程匹配必须用严格正则

```powershell
# 对
$_.CommandLine -match '@deepseek-ai[\\/]+dsh[\\/]+lib[\\/]+bin\.js"?\s+web\s*$'
# 错：会匹配到「命令行文本里恰好含该模式」的无关进程（实测计数 2 vs 1）
$_.CommandLine -like '*bin.js*web*'
```

误判后果最阴：守卫以为「已有实例」，**脚本跑了却永远不启动，且毫无报错**。
更稳的第一判据是端口：`Get-NetTCPConnection -LocalPort 3080 -State Listen`。

### 启动用 `&`，不要用 `Start-Process`

`& node bin.js web *>> 日志` 让 node 成为子进程、脚本阻塞其生命周期 →
任务全程保持 `Running` → `IgnoreNew` 才真正防重复。
若 `Start-Process` 后台启动、脚本立刻退出，任务被判「已完成」，防重复就失效了。

### Interactive 令牌下的环境

实测：用户级持久化的变量（`WORKBUDDY_AUTH_FILE`、`MCP_GITHUB_TOKEN` 等）**能读到**。
`DSH_HOME`/`DSH_PROFILE`/`DSH_WEB_URL` 本就不持久化（由 CLI 注入），任务不需要它们。

### 认证与 30 天 cookie

- 启动打印的 URL 带**每进程随机 token**；token 换取**绑定 host:port 的签名 cookie**。
- 签名密钥**持久化**在 `$DSH_HOME/.credentials.yaml` 的
  `client-connection/browser-session` 记录里 → **cookie 跨重启存活**。
- cookie 默认 **30 天**（`cookieMaxAgeDays`），且**裸访问 `/` 不续期**，
  只有带 `?token=` 访问才重签。
- 所以：让 DSH 自己开浏览器（默认）就永远不用碰 token；加 `--no-open` 则
  约每 30 天要从日志里捞一次 URL。**这就是输出必须落日志的原因。**

### 单实例硬约束

- 端口冲突**不礼让**：重复启动报 `EADDRINUSE` 直接失败退出。
- `dsh-remote` 是单实例的（`state.json` 的 `owner.pid` 仲裁）：两个实例会互踢，
  **弄坏手机遥控链接** —— 见 [`dsh-remote.md`](./dsh-remote.md)。

## 验证方式

```powershell
Export-ScheduledTask  -TaskPath '\DSH\' -TaskName 'DSH-Web-Autostart'  # 核对 PT0S / Delay / 电池项
Get-ScheduledTaskInfo -TaskPath '\DSH\' -TaskName 'DSH-Web-Autostart'  # LastTaskResult = 0
Get-NetTCPConnection  -LocalPort 3080 -State Listen                    # 有监听
```

真实验证只能靠**注销 / 重启一次**（无法在会话内自测）。
若任务卡在 `Running` 但端口没监听（上次注销留下的残留状态），
`Stop-ScheduledTask` + `Start-ScheduledTask` 清一下。

## 相关

- [`dsh-restart.md`](./dsh-restart.md) —— 为什么不能从会话内重启
- [`dsh-environment.md`](./dsh-environment.md) —— 只用 web 端
- [`dsh-remote.md`](./dsh-remote.md) —— 单实例与配对状态
- [`windows.md`](./windows.md) —— 脚本坑

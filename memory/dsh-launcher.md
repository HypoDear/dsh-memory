# DSH Web 启动：一个快捷方式，无自启无守卫

- **标签**：`dsh` `launcher` `windows`
- **更新**：2026-10-17
- **状态**：有效

## 结论

- **没有开机自启、没有崩溃重拉、没有常驻进程。** 曾经用「计划任务 + 守卫脚本 + `RestartCount`」，已全部移除：代价是一个常驻 pwsh 一直活着，而崩溃重拉这个收益实际用不上。
- **唯一入口**：任务栏鲸鱼图标 → 点一下弹菜单（打开界面 / 重启 / 停止）→ 选完退出。
- dsh 用 `Start-Process` 独立启动，**脚本退出后继续活着** → 不需要任何托管机制。
- 全部逻辑在 `~/.dsh/autostart/open-dsh.ps1`，用 `-Action {menu|open|restart|stop|status|install}` 区分；同目录 `README.md`。
- 桌面 `DSH.lnk` 由 `-Action install` 生成，可自行固定到任务栏。

## 细节

### 启动必须带 `--no-open`

`dsh web` **默认自己会打开浏览器**（日志里的 `dsh web: opening the default browser`）。脚本在端口就绪后也会开一次 → 一次点击冒出两个标签。
这是「一次弹两个」的**主要根因**，光在脚本侧去重治不了。

### 每次点击只开一个标签，不去重已有标签

需求是「每次点击只开 1 个」，不是「全局只留 1 个」。旧标签能和新标签共存，所以**不需要**去找、去切已有标签。
脚本只保留一个 3 秒连点保护（跨进程文件时间戳，因为每次点击都是新的 pwsh 进程，进程内锁管不到别的进程）。

### 状态探测的性能坑

`Get-NetTCPConnection` 实测 **1886ms**，菜单和重启明显卡顿。
改用 `TcpClient` 直连探测端口后 **35ms**（快 50 倍）；进程识别先用 `Get-Process -Name node` 快筛，再只对 node 查命令行（`Get-CimInstance` 的全量扫描约 190ms）。
`status` 从约 4 秒降到约 0.9 秒。

### 进程匹配必须用严格正则

```powershell
# 对
$_.CommandLine -match '@deepseek-ai[\\/]+dsh[\\/]+lib[\\/]+bin\.js"?\s+web\s*$'
# 错：会匹配到「命令行文本里恰好含该模式」的无关进程
$_.CommandLine -like '*bin.js*web*'
```

误判后果最阴：以为「已有实例」，**脚本跑了却永远不启动，且毫无报错**。

### 菜单弹出位置用「点击那一刻」的坐标

脚本起来后先做状态探测（1-3 秒），之后才读 `Cursor.Position` 的话，鼠标早已移开，菜单会弹到离点击处很远的地方。
必须在**脚本最开头**就抓住光标坐标。

### 单实例硬约束

- 端口冲突**不礼让**：重复启动报 `EADDRINUSE` 直接失败退出。
- `dsh-remote` 是单实例的（`state.json` 的 `owner.pid` 仲裁）：两个实例会互踢，**弄坏手机遥控链接** —— 见 [`dsh-plugins.md`](./dsh-plugins.md)。

### 认证与 30 天 cookie

- 启动打印的 URL 带**每进程随机 token**；token 换取**绑定 host:port 的签名 cookie**。
- 签名密钥**持久化**在 `$DSH_HOME/.credentials.yaml` 的 `client-connection/browser-session` 记录里 → **cookie 跨重启存活**。
- cookie 默认 **30 天**（`cookieMaxAgeDays`），且**裸访问 `/` 不续期**，只有带 `?token=` 访问才重签。
- 现在带 `--no-open`，所以**连续 30 天没用过**才需要从日志捞一次 URL。日常正常使用不受影响。

### 图标

`.lnk` 的 `IconLocation` **只接受文件路径**，不支持内嵌图像。所以 `install` 时从 DSH 自带的 `favicon.svg` **运行时生成** `%LOCALAPPDATA%\DSH\dsh.ico`，仓库里不放二进制。

⚠️ 生成的 `.ico` 里 **48px 及以下必须是 BMP(DIB) 条目**，不能是 PNG：Explorer 为任务栏/桌面取小图标时只走 BMP 解码路径，PNG 条目在那些尺寸下会渲染成**空白图标**。只有 256×256 用 PNG。

### 脚本编码

`open-dsh.ps1` 含中文，存成 **UTF-8 with BOM**。无 BOM 时 Windows PowerShell 5.1 会按 ANSI 解码，中文注释会撕碎后续代码。

## 验证方式

```powershell
pwsh -File ~/.dsh/autostart/open-dsh.ps1 -Action status   # 状态/端口/日志路径
Get-ScheduledTask -TaskPath '\DSH\'                       # 应为空（自启已移除）
```

## 相关

- [`dsh-env.md`](./dsh-env.md) —— 本机只用 web 端
- [`dsh-restart.md`](./dsh-restart.md) —— 为什么重启必须走快捷方式
- [`windows.md`](./windows.md) —— Windows 脚本坑

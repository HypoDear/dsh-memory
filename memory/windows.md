# Windows 上的脚本坑与系统调优

- **标签**：`windows` `scripting` `cmd` `powershell` `registry`
- **更新**：2026-10-17
- **状态**：有效

## 一、脚本坑

### ① `.cmd` 必须纯 ASCII

`cmd.exe` 按 **OEM 代码页（中文 Windows = GBK）** 读 `.cmd`，UTF-8 的中文会让语法崩掉
（表现为每行被截断成 Fragments，报一堆「不是内部或外部命令」）。逻辑写进 `.mjs` / `.ps1`，
`.cmd` 只做 ASCII 壳：

```bat
@echo off
cd /d "%~dp0"
node diagnose.mjs
```

验证：`Select-String -Path x.cmd -Pattern '[^\x00-\x7F]'` 无匹配。

### ② 含中文的 `.ps1` 要 UTF-8 **带 BOM**

Windows PowerShell **5.1** 读无 BOM 的 UTF-8 文件时按 **ANSI** 解码，中文注释会把后续代码撕碎
（报 `Unexpected token` / `Missing closing '}'`）。存成 UTF-8 with BOM 则 5.1 与 pwsh 7 都能正确解析。

### ③ 打开 URL 用 `rundll32`，不用 `cmd /c start`

`cmd` 把 URL 里的 `&` 当命令分隔符，链接被截断（登录页报「链接不完整」）：

```js
spawn('rundll32', ['url.dll,FileProtocolHandler', url],
  { stdio: 'ignore', detached: true, windowsHide: true }).unref()
```

### ④ 软链接验证：先判断目标是相对还是绝对

```powershell
$target = (Get-Item $link -Force).Target
$abs = if ([IO.Path]::IsPathRooted($target)) { $target } else { Join-Path (Split-Path $link) $target }
Test-Path ([IO.Path]::GetFullPath($abs))
```

- 直接 `Join-Path` 会在目标是绝对路径时拼出畸形路径（复现它自己要防的误报）
- 最省事的判断其实是 `Test-Path $link` 本身
- **目录链接**用 `Test-Path "$link\某文件"`；**文件链接**这样测会返回 `False`

### ⑤ 删软链用 `[System.IO.Directory]::Delete($link)`

只删链接本身，不动目标。送回收站 / 删目录的通用写法见
[`toolchain.md`](./toolchain.md) 第 7 节。

## 二、系统调优

三条改注册表 / 电源方案的命令，都建议用**管理员**权限。**都不是「立刻生效」**。

### ① 暂停更新 100 年（抬高上限，不是直接暂停）

```bat
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" /v FlightSettingsMaxPauseDays /t reg_dword /d 36500 /f
```

- 该值**只抬高「暂停更新」下拉框的最大天数**，本身**不会**暂停更新；
  之后仍需去 设置 → Windows 更新 里手动点一次「暂停」
- 36500 天 ≈ 100 年

### ② Win11 恢复 Win10 完整右键菜单

```bat
reg add "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve
```

- `/ve` 把默认值设为**空**，**不要**加 `/d`（加了反而失效）
- 改完必须**重启 explorer.exe** 才生效：`Stop-Process -Name explorer -Force`
- 还原：`reg delete "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}" /f`

### ③ 解锁「卓越性能」电源方案

```powershell
powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61
```

- `e9a42b02-...` 是微软**隐藏的** Ultimate Performance 母版，`powercfg /list` 里看不到，必须先 duplicate
- ⚠️ **duplicate 会生成一个全新随机 GUID**（不是 e9a42b02），需要再手动激活：
  `powercfg /setactive <新GUID>`
- ⚠️ **重复执行会复制出多份**「卓越性能」，不会覆盖旧的
- 桌面机才建议用；笔记本上会显著耗电

## 验证方式

```powershell
# 脚本坑
Select-String -Path x.cmd -Pattern '[^\x00-\x7F]'                  # 无匹配
[BitConverter]::ToString([IO.File]::ReadAllBytes('x.ps1')[0..2])  # EF-BB-BF = 有 BOM

# 系统调优
(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings').FlightSettingsMaxPauseDays
Test-Path 'HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32'
powercfg /list
```

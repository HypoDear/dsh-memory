# Windows 上的脚本坑

- **标签**：`windows` `scripting` `cmd` `powershell`
- **更新**：2026-10-12
- **状态**：有效

## 结论

Windows 上写脚本有四个反复踩到的坑：`.cmd` 的编码、`cmd /c start` 吃 `&`、
软链接验证的相对路径、以及 PowerShell 的嵌套引号。每一个都花了真实时间才定位。

## 背景

为了让用户“双击一个文件就能跑完诊断”，我写了一个 `.cmd`。结果它输出一堆乱码：

```
'鈺愨晲鈺愨晲...' 不是内部或外部命令
```

看起来像“文件損坏”，实际是**编码问题**。后续又陆续踩到另外三个。

## 细节

### ① `.cmd` 必须纯 ASCII

`cmd.exe` 按 **OEM 代码页**（中文 Windows 是 GBK/936）读 `.cmd` 文件，
而文件是 UTF-8 保存的 —— 于是中文和制表符变成乱码，**并且会破坏语法**，
报出各种“不是内部或外部命令”。

**做法**：逻辑全部写进 `.mjs`（Node 全程 UTF-8，且本机已验证可用），
`.cmd` 只留一个 ASCII 壳：

```bat
@echo off
cd /d "%~dp0"
node diagnose.mjs
pause
```

验证：`Select-String -Path x.cmd -Pattern '[^\x00-\x7F]'` 应无匹配。

### ② 别用 `cmd /c start <url>` 打开链接

`cmd` 把 URL 里的 `&` 当作**命令分隔符**：

```
...login?platform=workbuddy&state=xxx
                        ↑ 在这里被截断
```

浏览器只拿到半截链接，登录页报「登录链接不完整」。

**做法**：用 `rundll32`，它把整段 URL 原样交给 ShellExecute：

```js
spawn('rundll32', ['url.dll,FileProtocolHandler', url], {
  stdio: 'ignore', detached: true, windowsHide: true,
}).unref()
```

### ③ 软链接验证要按链接所在目录解析

`Test-Path` 对相对目标的软链接**不会**按链接自己所在的目录去解析，
直接传会误报 `False`，让人以为链接断了：

```powershell
# 会误导的判断
(Get-Item $link).Target        # 相对路径字符串
Test-Path (Get-Item $link).Target   # ← False，但链接其实是好的

# 正确：先拼上链接所在目录再判断
$abs = Join-Path (Split-Path $link) (Get-Item $link -Force).Target
Test-Path ([System.IO.Path]::GetFullPath($abs))
```

### ④ PowerShell 里别用嵌套中文引号

`"...链接到仓库"..."` 这种写法会触发 `ParserError`（中文引号被当字符串定界符）。
改用拼接或单引号。

### 附：送回收站

```powershell
Add-Type -AssemblyName Microsoft.VisualBasic
$recycle = [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
$ui = [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path, $ui, $recycle)
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($dir, $ui, $recycle)
```

## 验证方式

- `.cmd`：双击跑一次，不应出现 `鈺愨晲` 类乱码
- `rundll32`：确认浏览器地址栏里 `&` 后面的参数完整
- 软链接：`Test-Path "$link\<某文件>"` 穿透验证

## 相关

- [`dsh-bundle-patch.md`](./dsh-bundle-patch.md)

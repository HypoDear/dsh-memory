# Windows 上的脚本坑

- **标签**：`windows` `scripting` `cmd` `powershell`
- **更新**：2026-10-14
- **状态**：有效

## 结论

四条反复踩到的坑，只留做法。

### ① `.cmd` 必须纯 ASCII

`cmd.exe` 按 **OEM 代码页（中文 Windows = GBK）** 读 `.cmd`，UTF-8 的中文会让语法崩掉。
逻辑写进 `.mjs`，`.cmd` 只做 ASCII 壳：

```bat
@echo off
cd /d "%~dp0"
node diagnose.mjs
pause
```

验证：`Select-String -Path x.cmd -Pattern '[^\x00-\x7F]'` 无匹配。

### ② 打开 URL 用 `rundll32`，不用 `cmd /c start`

`cmd` 把 URL 里的 `&` 当命令分隔符，链接被截断（登录页报「链接不完整」）：

```js
spawn('rundll32', ['url.dll,FileProtocolHandler', url],
  { stdio: 'ignore', detached: true, windowsHide: true }).unref()
```

### ③ 软链接验证：先判断目标是相对还是绝对

```powershell
$target = (Get-Item $link -Force).Target
$abs = if ([IO.Path]::IsPathRooted($target)) { $target } else { Join-Path (Split-Path $link) $target }
Test-Path ([IO.Path]::GetFullPath($abs))
```

- 直接 `Join-Path` 会在目标是绝对路径时拼出畸形路径（复现它自己要防的误报）
- 最省事的判断其实是 `Test-Path $link` 本身
- **目录链接**用 `Test-Path "$link\某文件"`；**文件链接**这样测会返回 `False`

### ④ 不要混用全角引号与 ASCII 定界符

`"a“b”c"` 会 `ParserError`。全角引号单独作定界符是合法的 —— 炸掉的是**混用**。
做法：不在 ASCII 定界符里嵌全角引号，改用拼接或单引号。

### 附：送回收站

```powershell
Add-Type -AssemblyName Microsoft.VisualBasic
$ui = [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs
$rc = [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($dir, $ui, $rc)
```

## 验证方式

- `.cmd`：双击跑一次，无乱码
- URL：浏览器地址栏里 `&` 后面的参数完整
- 软链接：文件用 `Test-Path $link`，目录用 `Test-Path "$link\某文件"`

## 相关

- [`workbuddy.md`](./workbuddy.md) —— 登录脚本与凭据
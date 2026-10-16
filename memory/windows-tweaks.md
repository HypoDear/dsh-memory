# Windows 系统调优：暂停更新、右键菜单、卓越性能

- **标签**：`windows` `registry` `powercfg` `tweaks`
- **更新**：2026-10-16
- **状态**：有效

## 结论

三条改注册表 / 电源方案的命令，都建议用**管理员**权限（第一条在 HKLM，后两条虽在
HKCU 但是改 shell 行为）。**命令本身可直接用，但都不是「立刻生效」**：
第一条只抬高上限、第二条要重启 explorer、第三条只是复制出方案还得手动激活。

### ① 暂停更新 100 年（抬高上限，不是直接暂停）

```bat
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" /v FlightSettingsMaxPauseDays /t reg_dword /d 36500 /f
```

- 该值**只抬高「暂停更新」下拉框的最大天数**，本身**不会**暂停更新；
  之后仍需去 设置 → Windows 更新 里手动点一次「暂停」
- 36500 天 ≈ 100 年
- 新版 Windows 可能对上限有额外钳制（未实测）

### ② Win11 恢复 Win10 完整右键菜单

```bat
reg add "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve
```

- `/ve` 把默认值设为**空**，**不要**加 `/d`（加了反而失效）
- 改完必须**重启 explorer.exe** 才生效（会自动重启）：
  ```powershell
  Stop-Process -Name explorer -Force
  ```
- 想**还原**回 Win11 新版右键菜单：
  ```bat
  reg delete "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}" /f
  ```

### ③ 解锁「卓越性能」电源方案

```powershell
powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61
```

- `e9a42b02-...` 是微软**隐藏的** Ultimate Performance 母版，
  `powercfg /list` 里看不到它，必须先 duplicate 才能用
- ⚠️ **duplicate 会生成一个全新随机 GUID**（不是 e9a42b02），需要再手动激活：
  ```powershell
  powercfg /list                 # 找到新出来的「卓越性能」GUID
  powercfg /setactive <新GUID>
  ```
- ⚠️ **重复执行会复制出多份**「卓越性能」，不会覆盖旧的
- 桌面机才建议用；笔记本上会显著耗电

## 验证方式

```powershell
# ① 值是否已写入
(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings').FlightSettingsMaxPauseDays

# ② 键是否存在（存在且默认值为空 = 已改）
Test-Path 'HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32'

# ③ 方案是否已生成，并看哪个是当前激活
powercfg /list
```

三者都不需要重启系统：① 即时、② 重启 explorer 即可、③ 激活后即时。

## 相关

- [`windows.md`](./windows.md) —— Windows 上的脚本坑（cmd 编码、URL 的 `&`、软链接）

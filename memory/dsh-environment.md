# 本机 DSH 环境：只用 web 端

- **标签**：`dsh` `environment`
- **更新**：2026-10-16
- **状态**：有效

## 结论

- **只用 `dsh web`**（http://127.0.0.1:3080），`DSH_PROFILE=web`
- **桌面端（Electron）已卸载**，不再需要，也不再验证
- 因此：**所有插件的 profile 目标一律是 `web`**。命令里不要再写 `--profile desktop`
- ⚠️ `desktop` profile 目录**仍在磁盘上**，但 CLI 对它报
  `profile "desktop" is managed exclusively by the Electron application`
  —— 桌面端没了，这个 profile 实际上**无法再用 CLI 管理**，要改只能手改文件

## 细节

### 当前 web profile 装的东西

- bundle：`dsh-workbuddy-connect`、`dsh-remote`（都用 `link:`，源码目录即运行代码）
- MCP 走 home 层 `$DSH_HOME/cordis.patch.yml`（热生效，见 [`dsh-mcp.md`](./dsh-mcp.md)）

### 已退役 / 已删

- `dsh-mcp-remote-bundle`：已从 **web 与 desktop 两个** profile 卸载干净
  （依赖、bundles、软链、lockfile 均清），**源目录也已删**（送回收站）
- 它的职能已由 home 层 MCP 行接管，不再需要这个包

### 判断某个 profile 能不能用 CLI 管

```powershell
node "$env:APPDATA\npm\node_modules\@deepseek-ai\dsh\lib\bin.js" --profile <name> --dump-config
```

能输出去组合树就能管；报 `managed exclusively by the Electron application` 就不能。

## 验证方式

```powershell
$env:DSH_PROFILE                 # 应为 web
Get-ChildItem "$env:USERPROFILE\.dsh\profiles"   # web 在用；desktop 可能仅作为残留存在
```

## 相关

- [`dsh-mcp.md`](./dsh-mcp.md) —— MCP 装载在哪一层、何时需要重启
- [`dsh-remote.md`](./dsh-remote.md) —— 遥控插件（现装在 web）
- [`dsh-workbuddy-connect.md`](./dsh-workbuddy-connect.md) —— 模型接入（现装在 web）

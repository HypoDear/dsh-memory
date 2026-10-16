# DSH 接 MCP：用官方 mcp-client 行，别自己写客户端

- **标签**：`dsh` `mcp`
- **更新**：2026-10-16
- **状态**：有效

## 结论

在 patch 层 `insert` 一行 `@deepseek-ai/dsh-mcp-client`（随 DSH 提供，无需自研）。
没有 `dsh mcp` 子命令；**新增行必须包在 `- insert:` 里，否则静默丢弃**（只留一条 stderr 警告）。

## 细节

```yaml
- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github          # 工具前缀 mcp__github__<tool>
        transport: streamable-http  # 或 stdio：配 command/args/env/cwd
        url: https://api.githubcopilot.com/mcp/
        headers:
          Authorization: !!js 'process.env.TOKEN ? `Bearer ${process.env.TOKEN}` : ""'
        failOnStartupError: false   # 缺凭据只少一台，不拖垮启动
```

- 落点：`$DSH_HOME/profiles/<profile>/cordis.patch.yml`（单 profile）或
  `$DSH_HOME/cordis.patch.yml`（全 profile）
- `serverName` 唯一、`[A-Za-z0-9_-]{1,32}`，**不能有点**
- `headers` 值必须是字符串（`!!js` 要兜底 `: ""`）
- 官方模板：DSH 自带 skill
  `@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/templates/mcp/`
- **本机实例**：`dsh-mcp-remote-bundle`（无依赖配置 bundle）——
  源码 `~/Documents/deepseek-harness/default-workspace/mcp-remote-bundle`，
  以 `link:` 同时装进 `web` 与 `desktop` 两个 profile。
  **目前只接 `github` 一台**；`tencent_docs` 已于 2026-10-16 移除
  （原 `MCP_TENCENT_DOCS_TOKEN` 用户环境变量保留未删，已无引用）。

### 改完怎么生效

patch/bundle 层**不被热重载**，改完必须**重启 DSH**（重启意味着当前会话断连）。
改前可用下面命令离线验证合成结果（ExitCode 1 是正常的，它照样会输出）：

```powershell
node "$env:APPDATA\npm\node_modules\@deepseek-ai\dsh\lib\bin.js" --profile web --dump-config
```

⚠️ 必须显式带 `--profile <name>`，否则只报 `--profile <name> is required` 就退出（输出为空），
容易误判成「配置没了」。

## 验证方式

- `--dump-config` 里能搜到 `serverName: <你的名字>`，且没有 `patch: entry <id> not found`
- 调用 `mcp__<serverName>__<tool>` 能通

## 相关

- [`dsh-workbuddy-connect.md`](./dsh-workbuddy-connect.md) —— 同为 `link:` 安装的插件

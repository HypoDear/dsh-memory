# DSH 接 MCP：用官方 mcp-client 行，别自己写客户端

- **标签**：`dsh` `mcp`
- **更新**：2026-10-14
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

- 落点：`$DSH_HOME/profiles/<profile>/cordis.patch.yml`（单 profile）或 `$DSH_HOME/cordis.patch.yml`（全 profile）
- `serverName` 唯一、`[A-Za-z0-9_-]{1,32}`，**不能有点**；`headers` 值必须是字符串（`!!js` 要兜底 `: ""`）
- 官方模板：DSH 自带 skill `@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/templates/mcp/`
- 本机实例：`dsh-mcp-remote-bundle`（无依赖配置 bundle，接 `tencent_docs` + `github`）

## 验证方式

调用 `mcp__<serverName>__<tool>`；启动 stderr 里没有 `patch: entry <id> not found`。
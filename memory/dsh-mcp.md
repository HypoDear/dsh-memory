# DSH 接 MCP：用官方 mcp-client 行，别自己写客户端

- **标签**：`dsh` `mcp` `hmr`
- **更新**：2026-10-16
- **状态**：有效

## 结论

在 patch 层 `insert` 一行 `@deepseek-ai/dsh-mcp-client`（随 DSH 提供，无需自研）。
没有 `dsh mcp` 子命令；**新增行必须包在 `- insert:` 里，否则静默丢弃**（只留一条 stderr 警告）。

底层只有**这一个插件**，一条配置对应一台服务器；传输只有 **`stdio` / `streamable-http`** 两种。

## 细节

### 五种装载形式（按写在哪）

| # | 形式 | 落点 | 作用域 | 生效 |
|---|---|---|---|---|
| A | profile 层 patch | `profiles/<p>/cordis.patch.yml` | 单 profile | ⚡ 热生效 |
| **B** | **home 层 patch** | `$DSH_HOME/cordis.patch.yml` | **所有 profile** | ⚡ 热生效 |
| C | bundle 包 | 独立包的 patch，经 `dsh.profile.bundles` 挂载 | 可多 profile 共享 | 🔁 要重启 |
| D | `--patch` 覆盖层 | 启动参数 | 单次启动 | 🔁 要重启 |
| E | plugin_manager | Web 侧边栏 / `plugin_manager` 工具 | 当前 profile | 只能装 bundle |

**本机用 B**（见 [`dsh-environment.md`](./dsh-environment.md)）—— 覆盖 web 与 desktop 两个 profile，
而且改完不重启。

```yaml
- insert:
    - id: mcp-github-client        # ⚠️ 不要用 bundle 里那个 mcp-github，见下
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github          # 工具前缀 mcp__github__<tool>
        transport: streamable-http  # 或 stdio：配 command/args/env/cwd
        url: https://api.githubcopilot.com/mcp/
        headers:
          Authorization: !!js 'process.env.TOKEN ? `Bearer ${process.env.TOKEN}` : ""'
        failOnStartupError: false   # 缺凭据只少一台，不拖垮启动
```

- `serverName` 唯一、`[A-Za-z0-9_-]{1,32}`，**不能有点**；同一 scope 内重名会**装载失败**
- `headers` 值必须是字符串（`!!js` 要兜底 `: ""`）
- 官方模板：DSH 自带 skill
  `@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/templates/mcp/`

### 写在哪一层，决定了要不要重启（最容易错的一点）

底层插件 `dsh-hmr` **只监视三个文件**：

```js
const patchFiles = [profile.patchPath, join(profile.home, PROFILE_PATCH_FILENAME)];
// 即 profiles/<name>/cordis.patch.yml 与 $DSH_HOME/cordis.patch.yml
await this.watchConfig(manifestPath, () => refresh(true));  // profiles/<name>/package.json
```

| 写在哪 | 热生效？ |
|---|---|
| `$DSH_HOME/cordis.patch.yml`（home 层，全 profile） | ⚡ **改完即生效，不用重启** |
| `$DSH_HOME/profiles/<name>/cordis.patch.yml`（profile 层） | ⚡ **改完即生效，不用重启** |
| `profiles/<name>/package.json` 的 `bundles` 列表 | ⚡ 变 bundle 列表会触发重组 |
| **bundle 包自带的 patch** | 🔁 **必须重启**（不被监视） |
| 插件 JS 源码（`lib/*.js`） | 🔁 **必须重启** |

**热生效的前提**：bundle 提供的 `hmr` 条目未被禁用。base bundle 默认
`disabled: !!js '!ctx.get("profileContext")'` —— web 有 `profileContext`，所以**开着**。
但它默认 `root: []`，即**只监视上述配置文件、不监视模块源码**（所以改 JS 仍需重启）。
要让 JS 也热重载，在 patch 里加：

```yaml
- id: hmr
  disabled: false
  config:
    root: ["."]
```

### 本机现状（2026-10-16 起）

- GitHub MCP 写在 **home 层** `$DSH_HOME/cordis.patch.yml` → 以后改配置不用重启
- 行 id 是 **`mcp-github-client`**（**不是** `mcp-github` —— 改名的原因见
  [`dsh-plugin-id-clash.md`](./dsh-plugin-id-clash.md)：沿用旧 id 会让那个 bundle 永远卸不掉）
- `serverName` 仍是 `github`，所以工具名 `mcp__github__*` 未变
- 原先的 `dsh-mcp-remote-bundle` 包已**卸载并删除源码**（两个 profile 均已清干净）
- `MCP_TENCENT_DOCS_TOKEN` 用户环境变量保留未删，已无引用

### 插件界面里能不能增删改 MCP？

**不能。** `dsh-mcp-client` **不注册配置页**（源码里没有 settings / configPage / registerConfig）；
GUI 里没有任何地方能编辑 MCP 的 `url` / `headers` / `serverName` —— 只能改 YAML 文本。

两个不同的界面，别混：

| 界面 | 看得到 MCP 吗 | 能改吗 |
|---|---|---|
| 侧边栏 **Plugins** | 只在「它是某个 bundle 的一行」时看到 | 只能**整车开关该行**（`disabled`）；**不能新增行** |
| 设置 → **Built-in plugins** | **都看得到**（只读清单，列出所有 Loader 条目，不分层） | 只读 |

推论：把 MCP 从 bundle 形式（C）改成 home 层（B），**侧边栏 Plugins 页就不再显示它了**
（它不再是 bundle），但仍能在设置的内置插件清单里看到。这是换 B 的真实代价。

## 验证方式

改配置前后都用下面命令离线比对（**必须显式带 `--profile`**，否则只报
`--profile <name> is required` 并输出空，容易误判成配置丢了；exit code 1 是正常的）：

```powershell
node "$env:APPDATA\npm\node_modules\@deepseek-ai\dsh\lib\bin.js" --profile web --dump-config
```

- 搜得到 `serverName: <你的名字>`，且没有 `patch: entry <id> not found`
- 调用 `mcp__<serverName>__<tool>` 能通

## 相关

- [`dsh-environment.md`](./dsh-environment.md) —— 本机只用 web 端
- [`dsh-plugin-id-clash.md`](./dsh-plugin-id-clash.md) —— 从 bundle 搬行时必须换 id
- [`dsh-restart.md`](./dsh-restart.md) —— 从会话内重启 DSH 为什么行不通

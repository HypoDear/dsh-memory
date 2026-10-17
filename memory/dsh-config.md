# DSH 配置层：MCP 怎么装、改哪层要重启

- **标签**：`dsh` `mcp` `hmr` `plugin`
- **更新**：2026-10-17
- **状态**：有效

## 结论

- 接 MCP 用官方 `@deepseek-ai/dsh-mcp-client`（随 DSH 提供，无需自研），在 patch 层 `insert` 一行。
- 没有 `dsh mcp` 子命令；**新增行必须包在 `- insert:` 里，否则静默丢弃**（只留一条 stderr 警告）。
- 一条配置对应一台服务器；传输只有 **`stdio` / `streamable-http`** 两种。

## 细节

### 五种装载形式（按写在哪）

| # | 形式 | 落点 | 作用域 | 生效 |
|---|---|---|---|---|
| A | profile 层 patch | `profiles/<p>/cordis.patch.yml` | 单 profile | ⚡ 热生效 |
| **B** | **home 层 patch** | `$DSH_HOME/cordis.patch.yml` | **所有 profile** | ⚡ 热生效 |
| C | bundle 包 | 独立包的 patch，经 `dsh.profile.bundles` 挂载 | 可多 profile 共享 | 🔁 要重启 |
| D | `--patch` 覆盖层 | 启动参数 | 单次启动 | 🔁 要重启 |
| E | plugin_manager | Web 侧边栏 / `plugin_manager` 工具 | 当前 profile | 只能装 bundle |

**本机用 B** —— 覆盖所有 profile，且改完不重启。

```yaml
- insert:
    - id: mcp-github-client        # ⚠️ 不要沿用 bundle 里那个 id，见下
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

### 写在哪一层，决定要不要重启（最容易错的一点）

底层插件 `dsh-hmr` **只监视三个文件**：`profiles/<name>/cordis.patch.yml`、
`$DSH_HOME/cordis.patch.yml`、`profiles/<name>/package.json`。

| 写在哪 | 热生效？ |
|---|---|
| `$DSH_HOME/cordis.patch.yml`（home 层） | ⚡ 改完即生效 |
| `profiles/<name>/cordis.patch.yml`（profile 层） | ⚡ 改完即生效 |
| `package.json` 的 `bundles` 列表 | ⚡ 会触发重组 |
| **bundle 包自带的 patch** | 🔁 **必须重启**（不被监视） |
| **插件 JS 源码（`lib/*.js`）** | 🔁 **必须重启** |

热生效的前提是 `hmr` 条目未被禁用。base bundle 默认
`disabled: !!js '!ctx.get("profileContext")'` —— web 有 `profileContext`，所以开着。
但它默认 `root: []`，即**只监视配置文件、不监视模块源码**。

### 行 id 与 bundle 撞车 → 那个 bundle 永远卸不掉

把 MCP 从 bundle 改成 home/profile 层时，**千万别沿用它原来的 `id` 和模块名**。
两者相同会让插件页判定该 bundle 正被使用，**拒绝卸载**（`bundle-in-use`）——
**重启也没用**，因为它比的不是进程状态，而是「这个 id 还在不在 Loader 树里」。

**换一个 id 即可**（模块名同名无妨，id 才是判定键）：

```yaml
# home 层：用 mcp-github-client，而非 bundle 里的 mcp-github
- insert:
    - id: mcp-github-client
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github     # serverName 才是模型看到的前缀，不要改这个
```

`serverName` 保持不变，工具名 `mcp__github__*` 就不变。

### 插件界面里能不能增删改 MCP？

**不能。** `dsh-mcp-client` 不注册配置页；GUI 里没有任何地方能编辑 `url` / `headers` / `serverName` —— 只能改 YAML 文本。

| 界面 | 看得到 MCP 吗 | 能改吗 |
|---|---|---|
| 侧边栏 **Plugins** | 只在「它是某个 bundle 的一行」时看到 | 只能整车开关该行（`disabled`）；**不能新增行** |
| 设置 → **Built-in plugins** | 都看得到（只读清单） | 只读 |

推论：把 MCP 从 bundle 形式改成 home 层后，**侧边栏 Plugins 页就不再显示它了**。

### 本机现状

- GitHub MCP 写在 **home 层** `$DSH_HOME/cordis.patch.yml`
- 行 id 是 **`mcp-github-client`**（**不是** `mcp-github`，原因见上）
- `serverName` 仍是 `github`，工具名 `mcp__github__*` 未变

## 验证方式

**必须显式带 `--profile`**，否则只报 `--profile <name> is required` 并输出空，容易误判成配置丢了；exit code 1 是正常的：

```powershell
node "$env:APPDATA\npm\node_modules\@deepseek-ai\dsh\lib\bin.js" --profile web --dump-config
```

- 搜得到 `serverName: <你的名字>`，且没有 `patch: entry <id> not found`
- 调用 `mcp__<serverName>__<tool>` 能通

## 相关

- [`dsh-env.md`](./dsh-env.md) —— 本机只用 web 端
- [`dsh-restart.md`](./dsh-restart.md) —— 改完要重启时怎么重启
- [`dsh-plugins.md`](./dsh-plugins.md) —— 本机装的两个自研插件

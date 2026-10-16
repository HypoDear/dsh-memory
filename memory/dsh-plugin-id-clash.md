# home 层 patch 坑：行 id 与 bundle 撞车会导致卸不掉

- **标签**：`dsh` `mcp` `plugin` `hmr`
- **更新**：2026-10-16
- **状态**：有效

## 结论

把 MCP 从 bundle 改成 home/profile 层时，**千万别沿用它原来的 `id` 和模块名**。
两者相同会让插件页判定该 bundle 正被使用，**拒绝卸载**（`bundle-in-use`）——
**重启也没用**，因为它比的不是进程状态，而是「这个 id 还在不在 Loader 树里」。

**换一个 id 即可**（模块名同名无妨，id 才是判定键）。

## 细节

### 现象

插件界面里点卸载，报错且卸不掉；`--dump-config` 里看不出异常。

### 源码依据（`dsh-plugin-manager` 的 `removeBundle`）

```js
const contributions = bundle.error === void 0 ? this.bundleRows(name) : [];
if (bundle.enabled) { await this.selectBundle(name, false); await this.reload(); }
if ([...this.ctx.loader.entries()].some((entry) =>
      entry.fiber?.uid != null &&
      contributions.some((row) => row.id === entry.options.id &&
                                 row.name === entry.options.name)))
  throw new ManagementFailure("bundle-in-use");
```

`bundleRows(name)` 读的是 **bundle 自己声明的行**。若你在 home 层写了一个
**同 id 同 name** 的行，它在 Loader 树里“活着”，于是命中 `bundle-in-use`。

### 正确做法

迁到 home/profile 层时换个 id，例如：

```yaml
# home 层：用 mcp-github-client，而非 bundle 里的 mcp-github
- insert:
    - id: mcp-github-client
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github     # serverName 才是模型看到的前缀，不要改这个
```

`serverName` 保持不变，工具名 `mcp__github__*` 就不变。

### 卸载后残余清理（实测清单）

GUI 卸载会清依赖与 lock，但**软链可能残留**，需手动补：

| 位置 | 是什么 |
|---|---|
| `profiles/<p>/package.json` 的 `dependencies` | 自动清 |
| `profiles/<p>/package.json` 的 `dsh.profile.bundles` | 自动清 |
| `profiles/<p>/pnpm-lock.yaml` | 自动清 |
| `profiles/<p>/node_modules/<name>` | **可能残留孤儿软链** |

删软链**务必送回收站**，并确认**源目录仍在**（删软链不应伤及目标）。
另外顺手查 `node_modules` 里其它**已不再声明的**软链（同样会成孤儿）。

## 验证方式

卸载后：

```powershell
# 应无输出
Select-String -Path "$env:USERPROFILE\.dsh\profiles\web\package.json" -Pattern '<bundle 名>' -SimpleMatch
# 应无输出（软链已清）
Test-Path "$env:USERPROFILE\.dsh\profiles\web\node_modules\<bundle 名>"
```

## 相关

- [`dsh-mcp.md`](./dsh-mcp.md) —— MCP 的多种装载形式与热生效规则
- [`dsh-environment.md`](./dsh-environment.md) —— 本机只用 web 端

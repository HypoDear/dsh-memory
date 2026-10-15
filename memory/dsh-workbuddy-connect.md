# dsh-workbuddy-connect：WorkBuddy 模型接入 DSH（自有分支）

- **标签**：`workbuddy` `dsh` `credential` `plugin`
- **更新**：2026-10-15
- **状态**：有效

## 结论

- 模型接入**不需要桌面端 App**：插件 `dsh-workbuddy-connect` 是 provider（必须装）；
  登录只是换令牌，而**登录能力已内置进插件**（`login` 子命令），不再需要外部脚本
- 凭据用**明文文件** + 纯 HTTP 刷新；「不用桌面端」≠「不用插件」
- **仓库是自己的**：`HypoDear/dsh-workbuddy-connect`（公开），源码整理自上游同名 MIT 项目 0.7.5。
  再分发必须**保留上游版权与许可声明**（`LICENSE` 原样保留）
- 本分支两处改造：**移除内置升级提醒**；**推理档位固定 `high` 并移除档位检测**
- 本机以 `link:` 装进 `desktop` profile（源码目录即运行代码，改完重启即生效）
- 安装步骤与命令细节见仓库 README，这里只记环境事实

## 细节

### 安装（link 方式）

```powershell
pnpm install && pnpm run build
pnpm install --prod      # ⚠️ 必须
```

⚠️ **`--prod` 不能省**：link 运行时解析的就是本仓库的 `node_modules`，完整安装会把
`@deepseek-ai/*`（peerDependency）的一份副本放进插件目录，运行时**优先于宿主同名包**被解析，
等于同进程两份 `cordis` / `pi-ai`。剪成生产依赖后只剩插件该自带的 `@earendil-works/pi-ai`。

⚠️ **但命令行必须自带宿主工具包** —— 两者是不同的解析路径：

| 产物 | 谁加载 | @deepseek-ai/* 怎么办 |
|---|---|---|
| `lib/index.js` | DSH 宿主内嵌加载 | **必须留在外部**，由宿主提供 |
| `lib/bin.js` | 独立 node 进程 | **必须内联**（`tsdown.config.ts` 的 `alwaysBundle`），否则启动即 `ERR_MODULE_NOT_FOUND` |

所以 `index` 与 `bin` **刻意分成两份配置、不共享 chunk**：tsdown 默认把
`peerDependencies` 外部化，必须显式 `alwaysBundle` 才会内联。内联安全是因为
`dsh-home-paths` / `dsh-atomic-write` 都不持有进程级单例（后者只是文件系统锁约定）。
**改构建配置时别把两者合回多入口单次构建**，否则内联副本会被拖进宿主那份 = 自造双实例。

跑 CLI 的正确姿势（profile 作用域，否则解析不到）：

```powershell
dsh plugin --profile desktop exec dsh-workbuddy-connect status --json
```

### 凭据

查找顺序：**环境变量 → 桌面端加密文件 → 插件自留副本**。

⚠️ 桌面端加密文件**只要存在就优先**，解不开时直接报错、不回退 —— 想脱离桌面端必须删掉它。

```powershell
WORKBUDDY_AUTH_FILE     = <目录>\workbuddy-cn.json
WORKBUDDY_AI_AUTH_FILE  = <目录>\workbuddy-ai.json
```

改完**必须重启 DSH**。

- 明文登录文档：`$DSH_HOME/workbuddy-auth/workbuddy-cn.json` / `workbuddy-ai.json`（`login` 写这里）
- 插件自留副本：`$DSH_HOME/.workbuddy-auth.json` / `.workbuddy-ai-auth.json`
- 文档结构：`{ auth: { accessToken, refreshToken, expiresAt, refreshExpiresAt, domain }, account: { uid, nickname, enterpriseId } }`
  —— **只强制 `accessToken` 非空**
- `domain` 决定区域：`""` = 国内版，`workbuddy.ai`（含子域）= 国际版；
  写不匹配的域报 **`credential-region-mismatch`**

### 端点

| | 国内版 | 国际版 |
|---|---|---|
| base | `copilot.tencent.com` | `www.workbuddy.ai` |
| Origin/Referer | `www.codebuddy.cn` | `www.workbuddy.ai` |
| platform | `workbuddy` | `workbuddy-ai` |

⚠️ 服务端下发的 `authUrl` 里 `platform` **恒为 `workbuddy`**（实测确认），国际版必须改成
`workbuddy-ai`；URL 还可能缺 `state` / `version`，缺了登录页报「登录链接不完整」。
**插件的 `login` 已自动修正这两点。**

### 刷新与签到

```
POST {base}/v2/plugin/auth/token/refresh
X-Refresh-Token: <refreshToken>
```

| | refreshToken 寿命 | 签到 |
|---|---|---|
| 国内版 | ~30 天 | 有 |
| 国际版 | ~363 天 | 无（「活动未开启或已过期」） |

⚠️ 两平台 `code` 都是 `10001` 但含义不同（国内 = 今天已签，国际 = 活动未开启）—— **看文案**。
`X-Device-Token`（风控指纹）**不带也能跑**；`checkin` **刻意不发**这个头，这正是要测量的变量。

### 推理档位（本分支固定 high）

- 会推理的模型只提供、只发送 `high`；不会推理的不发 `reasoning_effort`
- 值在 `src/adapter.ts` 的 `FIXED_REASONING_EFFORT`，改这一处即可
- 依据：实测两目录里凡声明档位集合者**都含 `high`**（国内 7/7、国际 15/15）
- 代价：原本不声明档位的模型现在也会收到 `high`
- **档位检测能力已整体移除**（UI、路由动作、探测模块、`probeConsent` 设置）

### 模型可见性（缩到只显示 deepseek 系）

`$DSH_HOME/.workbuddy-model-visibility.json`（国内版）/ `.workbuddy-ai-model-visibility.json`（国际版），
**每账号一份 disabled 名单**（不是白名单）：

```json
{ "version": 1, "accounts": { "<uid>:<enterpriseId>": { "disabled": ["模型 id"], "updatedAtMs": 0 } } }
```

- 只隐藏列出的 id；新账号与上游新增模型默认可见 → 想只留 deepseek 系就把其余全部列进去
- 国际版开头 `default-model`(Auto) / `fast-model`(Fast) / `balanced-model`(Balanced) /
  `primary-model`(Primary) 也是 catalog 条目，同样能隐藏
- 正常由插件设置页维护；手改先备份，改完重启 DSH

### 命令行

```
dsh-workbuddy-connect <checkin|doctor|login|logout|status> [--provider <id>] [--json]
```

`login` 另接受 `--no-open`；`checkin` 另接受 `--claim`。

### 遗留数据文件

`$DSH_HOME/.workbuddy-probe.json` / `.workbuddy-ai-probe.json` 是**已移除的档位探测**留下的
记录文件，现在没有任何代码读它们。确认无用后再删（删前留意 0.7.x 旧版可能仍会读）。

## 验证方式

- CLI（最省事，一次验完凭据 + 端点 + 签到 + 进程存活）：
  `dsh plugin --profile desktop exec dsh-workbuddy-connect doctor --json`
  —— `hints` 应为空数组，`signIn` 为 `signed-in`，`hostHeartbeat.processAlive` 为 true
- 额度与可见性：状态路由 `/plugins/dsh-workbuddy-connect/status`（及 `/ai/status`）
- 签到：`checkin`，国内版 `checkedToday` 真、国际版假
- 升级提醒已移除：`/plugins/dsh-workbuddy-connect/update` 应返回 **404**（旧版 200）
- 心跳版本：`$DSH_HOME/.workbuddy-host-heartbeat.json` 的 `pluginVersion`
  —— **只在启动时写一次**，所以它不更新就说明没真正重启

## 相关

- [`dsh-remote.md`](./dsh-remote.md) —— 同样 link 安装的自研插件
- [`windows.md`](./windows.md) —— 安装/脚本里踩过的 Windows 坑

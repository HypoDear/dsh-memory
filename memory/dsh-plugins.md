# 本机两个自研插件：dsh-remote 与 dsh-workbuddy-connect

- **标签**：`dsh` `plugin` `remote` `workbuddy`
- **更新**：2026-10-17
- **状态**：有效

两个插件都以 `link:` 装进 **`web`** profile（源码目录即运行代码，改完重启即生效）。
完整用法见各自仓库 README，这里只记**环境事实和坑**。

| 插件 | 仓库 | 干什么 |
|---|---|---|
| `dsh-remote` | `HypoDear/dsh-remote`（公开） | 手机浏览器遥控桌面 DSH 的真实工作区与会话 |
| `dsh-workbuddy-connect` | `HypoDear/dsh-workbuddy-connect`（公开） | WorkBuddy 模型接入（provider） |

---

## dsh-remote

### 关键事实

- **不走局域网**：经公共中继 + 第三方遥控网页；手机端无需装 App，但电脑端 DSH 必须保持运行且联网
- 链路只有逐跳传输加密，**不是端到端加密**；遥控网页与中继由第三方运营
- 入口在**侧边栏**账号头像正上方一行，图标是**手机 + 信号弧**（自绘 SVG，不依赖宿主 primitives）。
  展开态显示「远程控制」文字，收起态只显图标；状态色：已连接=绿 / 连接中·等待·重连=黄 / 失败=红

### 配对状态（敏感）

`$DSH_HOME/dsh-remote/state.json`（0600）—— 含中继 pass hash，**等同凭据**：
**不要外传、不要提交进任何仓库**。同目录 `diagnostics.jsonl` 是运行诊断日志。

### `lib/wire.js` 是打包产物，不是本项目代码

上游 `zai-org/ZCode`（Apache-2.0），见仓库 README 的来源表。重建用 `node build-vendor.mjs`，
脚本会做**命名净化**（协议必需的字面量收敛在 `lib/upstream-protocol.js`），
重建后 `wire.js` 里**不应出现任何 `zcode` 字样**，脚本会校验并在残留时报错退出。

### 单实例约束

`state.json` 的 `owner.pid` 仲裁：**两个 DSH 实例会互踢**，表现为 `diagnostics.jsonl` 里成片的
`Relay rejected the connection (KICKED)`，并**弄坏手机遥控链接** —— 见 [`dsh-launcher.md`](./dsh-launcher.md)。

---

## dsh-workbuddy-connect

### 关键事实

- 模型接入**不需要桌面端 App**：插件是 provider（必须装）；登录能力已内置（`login` 子命令），不再需要外部脚本。
- 凭据用**明文文件** + 纯 HTTP 刷新。「不用桌面端」≠「不用插件」。
- 源码整理自上游同名 MIT 项目 0.7.5；**再分发必须保留上游版权与许可**（`LICENSE` 原样保留）。
- 本分支两处改造：**移除内置升级提醒**；**推理档位固定 `high` 并移除档位检测**。

### 安装必须 `pnpm install --prod`

```powershell
pnpm install && pnpm run build
pnpm install --prod      # ⚠️ 必须
```

link 运行时解析的就是本仓库的 `node_modules`，**完整安装会把 `@deepseek-ai/*`（peerDependency）的副本放进插件目录**，运行时优先于宿主同名包被解析，等于同进程两份 `cordis` / `pi-ai`。剪成生产依赖后只剩插件该自带的 `@earendil-works/pi-ai`。

⚠️ **但构建 CLI 与运行是两条不同的解析路径**：

| 产物 | 谁加载 | `@deepseek-ai/*` 怎么办 |
|---|---|---|
| `lib/index.js` | DSH 宿主内嵌加载 | **必须留在外部**，由宿主提供 |
| `lib/bin.js` | 独立 node 进程 | **必须内联**（`alwaysBundle`），否则启动即 `ERR_MODULE_NOT_FOUND` |

**`alwaysBundle` 单独写是无效的**：tsdown 只内联**能实际解析到**的包。
`--prod` 后 `@deepseek-ai/*` 不在 `node_modules` → 解析失败 → **静默保留 `import`**，
构建显示成功、产物却在启动时崩。

实测（2026-10-17）：无链接时 `lib/bin.js` 184,290 bytes 且 import 保持外部，
`dsh plugin --profile web exec dsh-workbuddy-connect doctor` 直接
`ERR_MODULE_NOT_FOUND`；把宿主的 `@deepseek-ai` 临时 junction 进来后，
产物 194,648 bytes、`withFileLock` 被内联、doctor 正常返回 `hints: []`。

**所以重建 CLI 必须走 `pnpm run build:cli`**（`scripts/build-cli.ps1`）：
临时 junction → tsdown → 校验 `lib/bin.js` 无 `from "@deepseek-ai/` 且有
`withFileLock` → 移除 junction。校验不过就报错退出。

`index` 与 `bin` **刻意分成两份配置、不共享 chunk**。**别把两者合回多入口单次构建**，否则内联副本会被拖进宿主那份 = 自造双实例。

### 凭据

查找顺序：**环境变量 → 桌面端加密文件 → 插件自留副本**。

⚠️ 桌面端加密文件**只要存在就优先**，解不开时直接报错、不回退 —— 想脱离桌面端必须删掉它。

- 明文登录文档：`$DSH_HOME/workbuddy-auth/workbuddy-cn.json` / `workbuddy-ai.json`
- `domain` 决定区域：`""` = 国内版，`workbuddy.ai`（含子域）= 国际版；写不匹配的域报 `credential-region-mismatch`

### 端点

| | 国内版 | 国际版 |
|---|---|---|
| base | `copilot.tencent.com` | `www.workbuddy.ai` |
| Origin/Referer | `www.codebuddy.cn` | `www.workbuddy.ai` |
| platform | `workbuddy` | `workbuddy-ai` |

⚠️ 服务端下发的 `authUrl` 里 `platform` **恒为 `workbuddy`**，国际版必须改成 `workbuddy-ai`；URL 还可能缺 `state` / `version`。**插件的 `login` 已自动修正这两点。**

### 推理档位（本分支固定 high）

会推理的模型只提供、只发送 `high`；不会推理的不发 `reasoning_effort`。
值在 `src/adapter.ts` 的 `FIXED_REASONING_EFFORT`。依据：实测两目录里凡声明档位集合者**都含 `high`**（国内 7/7、国际 15/15）。

### 签到（自动化）

- **只有国内版有签到活动**；国际版上游返回「活动未开启或已过期」
- ⚠️ 两平台 `code` 都是 `10001` 但含义不同（国内 = 今天已签，国际 = 活动未开启）—— **看文案**
- 定时任务 `\WorkBuddyCheckin` **每日 09:00** 跑 `workbuddy-login\checkin-silent.cmd`
  → `checkin-notify.ps1` → `node checkin.mjs claim --variant cn --json`，结果弹 **Windows Toast**
- ⚠️ 通知**必须用 Windows PowerShell 5.1** 发（WinRT `Windows.UI.Notifications`，pwsh 7 加载不了该类型）
- 曾经的「每 4 小时轮询」任务**已删除** —— 国际版没有签到活动，一半请求白跑

### 模型可见性

`$DSH_HOME/.workbuddy-model-visibility.json`（国内）/ `.workbuddy-ai-model-visibility.json`（国际），
**每账号一份 disabled 名单**（不是白名单）。正常由插件设置页维护；手改先备份、改完重启。

### 命令行

```
dsh plugin --profile web exec dsh-workbuddy-connect <checkin|doctor|login|logout|status> [--json]
```

`login` 另接受 `--no-open`；`checkin` 另接受 `--claim`。

---

## 验证方式

```powershell
# dsh-remote：profile 里应是指向仓库的符号链接
Test-Path "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-remote"

# workbuddy：一次验完凭据 + 端点 + 签到 + 进程存活
dsh plugin --profile web exec dsh-workbuddy-connect doctor --json
#   hints 应为空数组，signIn 为 signed-in，hostHeartbeat.processAlive 为 true
```

心跳版本 `$DSH_HOME/.workbuddy-host-heartbeat.json` 的 `pluginVersion`
**只在启动时写一次** —— 它不更新就说明没真正重启。

## 相关

- [`dsh-env.md`](./dsh-env.md) —— 本机只用 web 端
- [`dsh-launcher.md`](./dsh-launcher.md) —— 启动/重启与单实例约束
- [`windows.md`](./windows.md) —— 安装/脚本里踩过的 Windows 坑

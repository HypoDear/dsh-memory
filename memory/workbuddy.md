# WorkBuddy 接入：凭据、端点、模型可见性

- **标签**：`workbuddy` `dsh` `credential`
- **更新**：2026-10-14
- **状态**：有效

## 结论

- 模型接入**不需要桌面端 App**：插件 `dsh-workbuddy-connect` 是 provider（必须装），登录脚本只负责换令牌
- 凭据用**明文文件** + 纯 HTTP 刷新；「不用桌面端」≠「不用插件」
- 上游是**第三方 MIT 项目**（npm / GitHub 同名 `dsh-workbuddy-connect`）：
  改代码或再分发必须保留版权与许可声明

## 凭据查找顺序（关键）

```
环境变量 → 桌面端加密文件 → 插件自留副本
```

⚠️ 桌面端加密文件**优先级更高**：它存在但解不开时**直接报错，不回退** —— 想脱离桌面端必须删掉它。

```powershell
WORKBUDDY_AUTH_FILE     = <目录>\workbuddy-cn.json
WORKBUDDY_AI_AUTH_FILE  = <目录>\workbuddy-ai.json
```

改完**必须重启 DSH**。

- 插件自留副本：`$DSH_HOME/.workbuddy-auth.json` / `.workbuddy-ai-auth.json`
- 文档结构：`{ auth: { accessToken, refreshToken, expiresAt, refreshExpiresAt, domain }, account: { uid, nickname } }`
  —— 只强制 `accessToken` 非空
- `domain` 决定区域：`""` = 国内版，`workbuddy.ai`（含子域）= 国际版；写别的域报 `credential-region-mismatch`

## 端点

| | 国内版 | 国际版 |
|---|---|---|
| base | `copilot.tencent.com` | `www.workbuddy.ai` |
| Origin/Referer | `www.codebuddy.cn` | `www.workbuddy.ai` |
| platform | `workbuddy` | `workbuddy-ai` |

⚠️ 服务端下发的 `authUrl` 里 `platform` 恒为 `workbuddy`，国际版必须手工改成 `workbuddy-ai`；
URL 必须带 `state`，否则报「登录链接不完整」。

## 刷新与签到

```
POST {base}/v2/plugin/auth/token/refresh
X-Refresh-Token: <refreshToken>
```

| | refreshToken 寿命 | 签到 |
|---|---|---|
| 国内版 | ~30 天 | 有 |
| 国际版 | ~363 天 | 无（返回「活动未开启或已过期」） |

⚠️ 两平台 `code` 都是 `10001` 但含义不同（国内 = 今天已签，国际 = 活动未开启）—— **看文案**。
`X-Device-Token`（风控指纹）**不带也能跑**。

## 模型可见性（缩到只显示 deepseek 系）

`$DSH_HOME/.workbuddy-model-visibility.json`（国内版）/ `.workbuddy-ai-model-visibility.json`（国际版），
**每账号一份 disabled 名单**（不是白名单）：

```json
{ "version": 1, "accounts": { "<uid>:<enterpriseId>": { "disabled": ["模型 id"], "updatedAtMs": 0 } } }
```

- 只隐藏列出的 id；新账号与上游新增模型默认可见 → 想只留 deepseek 系就把其余全部列进去
- 国际版开头 `default-model`(Auto) / `fast-model`(Fast) / `balanced-model`(Balanced) /
  `primary-model`(Primary) 也是 catalog 条目，同样能隐藏
- 正常由插件设置页维护；手改先备份，改完重启 DSH

## 验证方式

- 凭据与额度：状态路由 `/plugins/dsh-workbuddy-connect/status`（及 `/ai/status`）
- 模型可见性：同一路由的 `visibility.disabled` 回显生效中的隐藏列表
- 签到：`node checkin.mjs status`，两平台都应 `code 0`

## 相关

- [`windows.md`](./windows.md) —— 登录脚本里踩过的 Windows 坑
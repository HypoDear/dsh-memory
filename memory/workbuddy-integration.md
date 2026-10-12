# WorkBuddy 接入（脱离桌面端）

- **标签**：`workbuddy` `dsh` `credential` `oauth`
- **更新**：2026-10-12
- **状态**：有效

## 结论

WorkBuddy 模型接入**不再需要桌面端 App**。

- **插件 `dsh-workbuddy-connect` 必须保留** —— 它是 provider，负责调模型
- **登录脚本只负责拿令牌**，不调模型
- 凭据用**明文文件**，刷新走**纯 HTTP**

两件事容易搞混：「不用桌面端」不等于「不用插件」。

## 背景

WorkBuddy 5.6 起把 `accessToken` / `refreshToken` **加密落盘**（AES-256-GCM），
密钥藏在改版 Electron 的私有 binding 里。插件跑在 DSH 的 Node 上，
永远调不到那个 binding，只能每次把 App 的二进制拉起来当**解密预言机**
—— 这是插件对桌面端**唯一**的硬依赖。

而登录本身只是普通 HTTPS，于是可以绕开：直接用 OAuth 换明文令牌。

## 细节

### 凭据查找顺序（关键）

```
环境变量 → 桌面端加密文件 → 插件自留副本
```

⚠️ **加密文件「高于」其他来源**：它只要存在，解不开就**直接报错，不回退**。
所以想脱离桌面端，必须删掉它（它可能在登出后被改名成带时间戳的备份）。

### 环境变量

```powershell
WORKBUDDY_AUTH_FILE     = <目录>\workbuddy-cn.json
WORKBUDDY_AI_AUTH_FILE  = <目录>\workbuddy-ai.json
```

改完**必须重启 DSH**。

### `domain` 字段决定区域

`regionOf()` 只认 `workbuddy.ai` 及其子域：

| `domain` 值 | 区域 |
|---|---|
| `""` | 国内版 |
| `workbuddy.ai` | 国际版 |

国际版凭据若写了别的域，插件会抛 `credential-region-mismatch` 拒绝加载。

### 端点

| | 国内版 | 国际版 |
|---|---|---|
| base | `copilot.tencent.com` | `www.workbuddy.ai` |
| Origin/Referer | `www.codebuddy.cn` | `www.workbuddy.ai` |
| platform | `workbuddy` | `workbuddy-ai` |

⚠️ **服务端下发的 `authUrl` 里 `platform` 恒为 `workbuddy`**，
国际版必须手工纠正为 `workbuddy-ai`，否则会进到国内版的登录页。
同样要确保 URL 上带 `state`，缺了会报「登录链接不完整」。

### 刷新与寿命

刷新是纯 HTTP：

```
POST {base}/v2/plugin/auth/token/refresh
X-Refresh-Token: <refreshToken>
```

实测寿命差异很大：

| | refreshToken |
|---|---|
| 国内版 | ~30 天 |
| 国际版 | ~363 天 |

到期后重跑登录脚本即可，**不需要重装客户端**。

### `X-Device-Token` 不需要

社区对签到接口的 `X-Device-Token`（腾讯风控指纹）说法矛盾。
**实测：不带它也返回 `code 0`** —— 聊天与签到都正常。

### 签到

| | 有签到？ |
|---|---|
| 国内版 | ✅ 有 |
| 国际版 | ❌ 没有（返回「签到活动未开启或已过期」） |

两个平台的 `code` 都是 `10001`，但**含义不同**：
国内版 = 「今天已签」，国际版 = 「活动未开启」。**必须看文案，不能只看 code。**

## 验证方式

```powershell
node checkin.mjs status    # 两个平台都应 code 0
```

## 相关

- [`windows-scripting.md`](./windows-scripting.md) —— 登录脚本里踩过的 Windows 坑

<!-- 待落库后补上链接：dsh-bundle-patch.md（bundle patch 的 insert: 陷阱） -->

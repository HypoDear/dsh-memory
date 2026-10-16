# dsh-remote：手机遥控 DSH（自研插件）

- **标签**：`dsh` `remote` `plugin`
- **更新**：2026-10-16
- **状态**：有效

## 结论

- 自研 DSH 插件，仓库 `HypoDear/dsh-remote`（公开）。用手机浏览器遥控**桌面上跑着的 DSH 的真实工作区与会话**
- **不走局域网**：经公共中继 + 第三方遥控网页；手机端**无需装 App**，但电脑端 DSH 必须保持运行且联网
- 链路只有逐跳传输加密，**不是端到端加密**；遥控网页与中继由第三方运营
- 本机以 `link:` 装进 **`web`** profile（本机已不用桌面端，见 [`dsh-environment.md`](./dsh-environment.md)；源码目录即运行代码，改完重启即生效）
- 入口在**侧边栏**：左下角、账号头像正上方的一行「远程控制」（带状态色圆点）

## 细节

### 安装 / 更新

```powershell
# 只打包到 dist/
powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -PackOnly
# 装进 web profile（先关闭 DSH）
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

profile 登记（`$DSH_HOME/profiles/web/package.json`）：

```json
"dependencies": { "dsh-remote": "link:<仓库绝对路径>" },
"dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "...", "dsh-remote"] } }
```

侧边栏收起时该行随之隐藏（DSH 固有行为），用标题栏左上角按钮展开。

### 配对状态（敏感）

- `$DSH_HOME/dsh-remote/state.json`（0600）—— 含中继 pass hash，**等同凭据**：
  **不要外传、不要提交进任何仓库**
- 同目录 `diagnostics.jsonl` 是运行诊断日志

### `lib/wire.js` 是打包产物，不是本项目代码

| 项 | 值 |
|---|---|
| 上游 | `zai-org/ZCode`（公开，Apache-2.0） |
| pin 的 commit | `aac4755666d09fdcd70272fcf063c077a639015f` |
| 打包的包 | `packages/rpc`、`packages/client`、`packages/shared`、`packages/model-option-map` |

重建（仓库根目录，**不需要 git、不需要 tar**）：

```sh
node build-vendor.mjs                      # 就地重建
node build-vendor.mjs --out /tmp/wire.js   # 输出到别处做对比
ZCODE_SOURCE=<路径> node build-vendor.mjs  # 用本地已有 checkout
```

⚠️ 脚本会做**命名净化**：上游用 `zcode*` 命名，本项目改中性名，而协议必需的字面量
（中继地址、`zcode-*` 通道名、`zcode_type`、格式标记）统一收敛在 `lib/upstream-protocol.js`。
所以重建后 `wire.js` 里**不应再出现任何 `zcode` 字样**，脚本会校验并在残留时报错退出。

### 其它事实

- **许可**：仓库不附带许可文件；`lib/wire.js` 打包自 Apache-2.0 的上游 ZCode
- **依赖形态**：只有 `dependencies.qrcode`，**没有 devDependencies** ——
  所以不存在 dsh-workbuddy-connect 那种「完整安装会把 peer 副本塞进插件目录、遮蔽宿主」的问题
- **兼容性**：验证于 DSH 0.2.0-rc.2

## 验证方式

- profile 里 `node_modules/dsh-remote` 应是指向仓库的符号链接
- 侧边栏出现「远程控制」行；面板可开启并显示二维码
- 本地仓库与远端 `main` 逐文件 git blob 一致
  （2026-10-15 核对：18 个文件全部一致，远端 `3f84b49`）

## 相关

- [`dsh-environment.md`](./dsh-environment.md) —— 本机只用 web 端
- [`dsh-workbuddy-connect.md`](./dsh-workbuddy-connect.md) —— 同样 link 安装的插件
- [`windows.md`](./windows.md) —— 脚本与安装里踩过的 Windows 坑

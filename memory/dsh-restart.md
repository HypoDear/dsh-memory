# 从会话内重启 DSH：做不到，必须脱出进程树

- **标签**：`dsh` `restart` `windows`
- **更新**：2026-10-17
- **状态**：有效

## 结论

**agent 的 shell 是 DSH 进程的后代**，所以「从会话里重启 DSH」会砍掉自己坐的树枝：
DSH 一死，发起重启的辅助进程也跟着死，重启动作永远走不到「启动新实例」那一步。

症状恰是：**Web 界面断开连接，但后台也没有 `dsh web` 在跑** —— 看起来像挂了，
实际是「旧的被杀了、新的没来得及起来」。

## 要可靠重启，必须让动作发生在 DSH 进程树之外

- **首选**：点任务栏的 DSH 鲸鱼图标 →「重启 DSH」。见 [`dsh-launcher.md`](./dsh-launcher.md)。
- 备选：手动开一个独立终端跑 `dsh web`。

## 细节

- DSH **没有** `dsh restart` 子命令（`dsh --help` 里只有 `plugin`）。
- 每条 shell 命令都跑在 `@deepseek-ai/dsh-subprocess-local` 的托管子进程里。
- 「detached 辅助进程」那类方案实测**无效** —— 辅助进程同样在 DSH 进程树内，
  它会停在 `stopping dsh web pid=...` 就再无动静，「starting」那步从没发生过。

## 相关

- [`dsh-launcher.md`](./dsh-launcher.md) —— 正确的重启入口
- [`dsh-config.md`](./dsh-config.md) —— 哪些配置改动需要重启
- [`windows.md`](./windows.md) —— Windows 脚本坑

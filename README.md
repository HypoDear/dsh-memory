**作为 AI 记忆**：把本机的 `~/.dsh/AGENTS.md` 指向本仓库（软链接或复制），详见 [SPEC.md](./SPEC.md#五本机接入)。

**改了记忆之后**：本机没有 git，必须跑 `node sync.mjs` 把远程拉回本地，否则注入的仍是旧版。
`node verify.mjs` 可自检一致性。

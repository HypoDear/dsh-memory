# 工具链：本机没有 git，怎么操作 GitHub

- **标签**：`toolchain` `github` `api`
- **更新**：2026-10-17
- **状态**：有效

## 结论

**本机没有 `git`（也没有 `gh`）**，一切走 **GitHub REST API**。
内容一律**从磁盘读 + base64 上传**，绝不手工转写（长文件必出错）。

## 细节

### 1. token 取法

`MCP_GITHUB_TOKEN` 是**用户级**环境变量，**pwsh 子进程读不到**，必须显式取：

```powershell
$env:MCP_GITHUB_TOKEN = [Environment]::GetEnvironmentVariable('MCP_GITHUB_TOKEN','User')
```

必须是 `'User'`（不是 `'Machine'`、不是进程级）。取到后注入给 node 脚本，**不要打印**。

### 2. 提交五步（Git Data API）

比 Contents API 好：多文件一个提交，且能从磁盘读内容。请求头三件套：
`Authorization: Bearer <token>` / `Accept: application/vnd.github+json` /
`X-GitHub-Api-Version: 2022-11-28`。

```js
baseSha  = GET  /git/ref/heads/main
baseTree = GET  /git/commits/{baseSha}.tree.sha
blob     = POST /git/blobs  { content: readFileSync(p).toString('base64'), encoding:'base64' }
tree     = POST /git/trees  { base_tree: baseTree, tree: [
             { path, mode:'100644', type:'blob', sha } ] }     // 删文件写 sha: null
commit   = POST /git/commits { message, tree: tree.sha, parents: [baseSha] }
           PATCH /git/refs/heads/main { sha: commit.sha, force: false }
```

### 3. 三个坑

| 坑 | 后果 | 做法 |
|---|---|---|
| **不带 token** | 匿名限流 **60 次/小时/IP**，很快 403 | 每个请求都带 |
| **手工转写长文件** | 45KB 逐字复现必出错；MCP `push_files` 要求内联 | **从磁盘读**再 base64 |
| **中文提交信息** | 手工拼字符串易破 | `JSON.stringify` 整个 body |

### 4. 推完必须回读校验

```js
newTree = GET /git/trees/{commit.tree.sha}?recursive=1
// 逐文件比 git blob sha 或 SHA256；删掉的文件要确认真的不在新树里
```

**不校验等于没推** —— 曾因没校验，产物与预期不一致都没发现。

### 5. 读仓库

- **`read_mcp_resource`**（推荐）：`repo://<owner>/<repo>/contents/<path>`
- ⚠️ **不要用 `get_file_contents` 读正文** —— 返回「嵌入式资源块」，DSH 不投影给模型，
  正文读不到但调用显示成功
- 列目录：`get_file_contents` 能用（返回结构化列表，不是正文）

## 验证方式

```powershell
$t = [Environment]::GetEnvironmentVariable('MCP_GITHUB_TOKEN','User'); "长度 $($t.Length)"
curl.exe -sS -o NUL -w "%{http_code}" -H "Authorization: Bearer $t" `
  https://api.github.com/repos/Owner/Repo    # 应输出 200
```

## 相关

- [`windows.md`](./windows.md) —— Windows 脚本坑（含送回收站）
- [`SPEC.md`](../SPEC.md) —— 记忆写入流程

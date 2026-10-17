# 工具链：这台机器上没有 git，怎么操作外部系统

- **标签**：`toolchain` `github` `api`
- **更新**：2026-10-17
- **状态**：有效

## 结论

**本机没有 `git`**（也没有 `gh`），所有版本控制操作走 **GitHub REST API**。
内容一律**从磁盘读 + base64 上传**，绝不手工转写（长文件转写必出错）。

## 细节

### 1. token 从哪来

`MCP_GITHUB_TOKEN` 是**用户级**环境变量，**pwsh 子进程读不到**（`$env:` 里没有），必须显式取：

```powershell
$env:MCP_GITHUB_TOKEN = [Environment]::GetEnvironmentVariable('MCP_GITHUB_TOKEN','User')
```

**必须是用户级**（`'User'`），不是 `'Machine'`，也不是进程级。取到后通过进程环境注入给 node 脚本，**不要打印它**。

### 2. 提交五步（Git Data API，单提交原子）

比 Contents API 好：多个文件一个提交，且能从磁盘读内容。

```js
// ① 取基点
baseSha  = GET /git/ref/heads/main
baseTree = GET /git/commits/{baseSha}.tree.sha

// ② 每个文件建 blob（内容从磁盘读）
blob = POST /git/blobs { content: readFileSync(p).toString('base64'), encoding: 'base64' }

// ③ 一棵树：entries = [{ path, mode:'100644', type:'blob', sha }]
//    要删的文件写 sha: null
tree = POST /git/trees { base_tree: baseTree, tree: entries }

// ④ 一个提交
commit = POST /git/commits { message, tree: tree.sha, parents: [baseSha] }

// ⑤ 移动 ref
PATCH /git/refs/heads/main { sha: commit.sha, force: false }
```

请求头三件套：

```
Authorization: Bearer <token>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

### 3. 三个坑

| 坑 | 后果 | 做法 |
|---|---|---|
| **不带 token** | 匿名限流 **60 次/小时/IP**，实测很快耗尽，返回 403 rate limit | 每个请求都带 token |
| **手工转写长文件** | 45KB 的文件逐字复现必然出错；MCP 的 `push_files` 要求内容内联 | **从磁盘读**，用 `readFileSync(...).toString('base64')` |
| **中文提交信息** | 手工拼字符串易破 | 用 `JSON.stringify` 序列化整个 body |

### 4. 推完必须回读校验

```js
newTree = GET /git/trees/{commit.tree.sha}?recursive=1
// 逐文件比 git blob sha（sha1("blob <len>\0<content>")）或下载后比 SHA256
// 删掉的文件必须确认真的不在新树里
```

**不校验等于没推** —— 曾经因为没校验，构建产物和预期不一致都没发现。

### 5. 读仓库

- **MCP `read_mcp_resource`**（推荐）：`repo://<owner>/<repo>/contents/<path>`
- ⚠️ **不要用 `get_file_contents`** —— 返回「嵌入式资源块」，DSH 不投影给模型，
  正文读不到但调用显示成功
- 列表类（列目录）：`get_file_contents` 能用，返回的是结构化列表不是正文

### 6. 没有 git 时的替代操作

| 想要 | 用什么 |
|---|---|
| 看历史 | `GET /repos/{o}/{r}/commits?per_page=N` |
| 看某次提交改了什么 | `GET /repos/{o}/{r}/commits/{sha}`（`files` 数组带增删行数） |
| 删文件 | tree 里写 `sha: null`（见第 2 节） |
| 同步整个目录 | 枚举本地文件算 git blob sha，与远端树比对，只推差异 |

### 7. 删文件：优先送回收站

Windows 上没有 `rm -rf` 那份从容，删错了要有退路：

```powershell
Add-Type -AssemblyName Microsoft.VisualBasic
# 文件
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($f, 'OnlyErrorDialogs', 'SendToRecycleBin')
# 目录
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($d, 'OnlyErrorDialogs', 'SendToRecycleBin')
```

**删前先确认绝对路径就是目标**（`(Resolve-Path $p).Path -eq $p`），
删软链后用 `[System.IO.Directory]::Delete($link)` —— 只删链接，不动目标。

## 验证方式

```powershell
# token 可用（不打印值）
$t = [Environment]::GetEnvironmentVariable('MCP_GITHUB_TOKEN','User'); "长度 $($t.Length)"

# 仓库可访问
curl.exe -sS -o NUL -w "%{http_code}" `
  -H "Authorization: Bearer $t" `
  https://api.github.com/repos/Owner/Repo
# 应输出 200
```

## 相关

- [`windows.md`](./windows.md) —— Windows 脚本坑
- [`SPEC.md`](../SPEC.md) —— 记忆写入流程

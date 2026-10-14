# SPEC — 记忆规范

## 一、三层结构

| 层 | 文件 | 只写什么 | 长度 |
|---|---|---|---|
| 指针 | `~/.dsh/AGENTS.md`（本机） | 去哪读 | 几乎不变 |
| 一 | 仓库 `AGENTS.md` | 不知道就会做错的铁律 + 索引 | < 150 行 |
| 二 | `memory/*.md` | 细节 | 不限 |

## 二、记忆文件格式

复制 [`memory/_template.md`](./memory/_template.md)：**标签 / 更新 / 状态** 开头，
然后 **结论 → 细节 → 验证方式**。

- **先结论**：只看第一段就该知道怎么做
- **必须写验证方式**：环境会变，没有验证方式的记忆会腐烂
- **只记关键节点**：不写探索过程、不写「当时试了什么」
- 命名：小写英文 + 连字符（`dsh-mcp.md`），不用中文名
- 中文正文用全角标点，代码与路径用半角

## 三、写入流程

1. agent 提议（写什么 / 放哪 / 为什么值得记）
2. **用户确认后**才用 GitHub MCP 写入
3. 同步 **2 处**：`AGENTS.md` 索引表、`manifest.json` 的 `memories`（改名或删除时一并清掉旧条目）
4. 完成 —— 写入即发布，本机无副本、无同步脚本

**不写**：密钥令牌密码、个人隐私、公司内部信息、大段第三方版权内容。本仓库是**公开**的。

## 四、读取

```
read_mcp_resource(server="github",
                  uri="repo://HypoDear/dsh-memory/contents/AGENTS.md")
```

⚠️ 必须用 `read_mcp_resource`：`get_file_contents` 返回的「嵌入式资源块」DSH 不投影给模型，
**正文读不到但调用显示成功**。人看：<https://hypodear.github.io/dsh-memory/>

## 五、已知限制

需要网络与 GitHub MCP；离线时只能靠指针里的铁律。多设备天然支持（指针一致即可）。
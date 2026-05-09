# Flomo MCP Worker

把 Flomo Webhook 包装成一个远程 MCP Server，部署到 Cloudflare Workers 后，可作为 ChatGPT Connector / MCP Client 使用。

## 架构

```text
ChatGPT / MCP Client
  ↓ Streamable HTTP MCP
https://<worker-domain>/flomo/<URL_TOKEN>/mcp
  ↓ Worker 使用 TOKEN_SECRET 解密 URL_TOKEN
Flomo Webhook URL
  ↓ POST JSON
Flomo
```

## MCP Tool

本项目只暴露一个 tool：

```text
save_to_flomo(content, content_type = "markdown")
```

参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `content` | `string` | 要保存到 Flomo 的内容 |
| `content_type` | `"markdown" \| "text"` | 默认 `markdown` |

## 安全模型

- Worker Secret 只保存 `TOKEN_SECRET`。
- Flomo Webhook 不写进代码、不写进 `wrangler.jsonc`、不明文放进 URL。
- `URL_TOKEN` 是使用 `TOKEN_SECRET` 通过 AES-GCM 加密 Flomo Webhook 后得到的 URL-safe token。
- 完整 Connector URL 仍然等价于可写入 Flomo 的 bearer token，请不要公开。
- 如果 Connector URL 泄露，请重新生成 `TOKEN_SECRET` 和 `URL_TOKEN`，并更新 ChatGPT Connector URL。

## 根路径页面

访问：

```text
GET /
```

只会看到静态提示页。根路径不生成 token，也不会接收或保存 Flomo Webhook。

MCP endpoint 格式：

```text
/flomo/<URL_TOKEN>/mcp
```

健康检查：

```text
GET /healthz
```

## 本地开发

安装依赖：

```bash
npm install
```

准备本地 secret：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`：

```bash
TOKEN_SECRET="replace-with-a-long-random-secret"
```

启动本地 Worker：

```bash
npm run dev
```

## 本地生成 URL_TOKEN

```bash
npm run token -- --webhook "https://flomoapp.com/iwh/xxxx"
```

如果已经知道 Worker 域名，可以同时生成完整 Connector URL：

```bash
npm run token -- \
  --webhook "https://flomoapp.com/iwh/xxxx" \
  --origin "https://flomo-mcp-worker.yourname.workers.dev"
```

如果要使用已有 `TOKEN_SECRET`：

```bash
npm run token -- \
  --webhook "https://flomoapp.com/iwh/xxxx" \
  --secret "your-existing-token-secret" \
  --origin "https://flomo-mcp-worker.yourname.workers.dev"
```

## 首次一次性部署

首次部署推荐用：

```bash
npm run deploy:init -- --webhook "https://flomoapp.com/iwh/xxxx"
```

这个命令会：

1. 在本地生成 `TOKEN_SECRET`。
2. 在本地生成 `URL_TOKEN`。
3. 临时写入一个本地 secrets JSON 文件。
4. 执行 `npx wrangler deploy --secrets-file <temp-file>`，一次性部署代码和 Secret。
5. 删除临时 secrets 文件。
6. 输出 `Connector URL`。

如果你已经确定了自定义域名或 workers.dev 域名，也可以：

```bash
npm run deploy:init -- \
  --webhook "https://flomoapp.com/iwh/xxxx" \
  --origin "https://flomo-mcp-worker.yourname.workers.dev"
```

> 注意：`deploy:init` 会生成新的 `TOKEN_SECRET` 和 `URL_TOKEN`。如果只是之后改代码并保持旧 Connector URL 继续可用，请使用普通部署命令 `npm run deploy`，不要重新跑 `deploy:init`。

## 后续代码部署

如果 Secret 不变，只是修改 Worker 代码：

```bash
npm run deploy
```

## 手动设置 Secret

如果不用一次性部署，也可以手动设置：

```bash
npx wrangler secret put TOKEN_SECRET
npm run deploy
```

但首次使用这种流程通常会产生两次版本变更；想压成一次，请使用 `deploy:init` 或直接使用：

```bash
npx wrangler deploy --secrets-file .secrets.production
```

`.secrets.production` 示例：

```json
{
  "TOKEN_SECRET": "your-token-secret"
}
```

不要提交 `.secrets.production`。

## 添加到 ChatGPT Connector

部署后拿到：

```text
https://<worker-domain>/flomo/<URL_TOKEN>/mcp
```

在 ChatGPT 的 Connector / Developer mode 中创建 Connector，并填入上面的 URL。

测试：

```text
帮我保存到 Flomo：今天完成了 Flomo MCP Worker 的部署 #MCP #Flomo
```

预期 tool 返回：

```text
已保存到 Flomo。
```

## 测试和检查

```bash
npm run typecheck
npm test
npm run check
```

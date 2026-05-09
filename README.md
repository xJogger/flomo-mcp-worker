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

## Debian SSH 环境配置 Wrangler 认证

如果是在 Debian 服务器的 SSH 里运行部署命令，可能会遇到：

```text
In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
```

这是因为 SSH / 服务器环境通常不能通过浏览器完成 `wrangler login`。推荐给 Wrangler 配置 Cloudflare API Token。

### 1. 获取 Cloudflare Account ID

进入 Cloudflare Dashboard，选择你的账号后，在账号首页或 Workers & Pages 页面复制 `Account ID`。

### 2. 创建 Cloudflare API Token

1. 打开 Cloudflare Dashboard。
2. 如果创建用户 Token：进入 `My Profile` → `API Tokens`。
3. 如果创建账号 Token：进入 `Manage Account` → `API Tokens`。
4. 点击 `Create Token`。
5. 推荐选择 `Edit Cloudflare Workers` 模板。
6. 将资源范围限制到当前项目使用的 Cloudflare 账号，避免使用过大的全局权限。
7. 点击 `Continue to summary`，确认后点击 `Create Token`。
8. 复制生成的 token。token 只显示一次，请保存到安全位置。

参考文档：

- 创建 API Token：https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- Wrangler 系统环境变量：https://developers.cloudflare.com/workers/wrangler/system-environment-variables/

### 3. 在 Debian 项目目录设置 `.env`

在服务器上进入项目目录：

```bash
cd /path/to/flomo-mcp-worker
```

创建 `.env`：

```bash
cat > .env <<'EOF'
CLOUDFLARE_ACCOUNT_ID=你的_account_id
CLOUDFLARE_API_TOKEN=你的_cloudflare_api_token
EOF

chmod 600 .env
```

本项目的 `.gitignore` 已经忽略 `.env` 和 `.env.*`，不要把 Cloudflare API Token 提交到 GitHub。

> 注意：这里的 `.env` 是给 Wrangler CLI 登录 Cloudflare 用的；`TOKEN_SECRET` 是 Worker 运行时 secret，仍然放在 `.dev.vars`、Wrangler secret 或 `--secrets-file` 里。不要把两者混淆。

### 4. 验证 Token

让当前 shell 读取 `.env` 后验证：

```bash
set -a
. ./.env
set +a

curl -sS "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

也可以用 Wrangler 验证当前身份：

```bash
npx wrangler whoami
```

### 5. 部署

首次一次性部署：

```bash
npm run deploy:init -- --webhook "https://flomoapp.com/iwh/xxxx"
```

后续只改代码、保持旧 Connector URL 继续可用时：

```bash
npm run deploy
```

### 6. 可选：设置为当前 SSH 用户长期生效

如果不想每个项目都放 `.env`，也可以写入当前用户的 shell 配置：

```bash
cat >> ~/.bashrc <<'EOF'
export CLOUDFLARE_ACCOUNT_ID="你的_account_id"
export CLOUDFLARE_API_TOKEN="你的_cloudflare_api_token"
EOF

source ~/.bashrc
```

这种方式会让该 Debian 用户下的 Wrangler 命令默认使用同一个 Cloudflare Token。

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

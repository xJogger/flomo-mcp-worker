export const STATIC_HOME_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Flomo MCP Worker</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f6f7f9;
      color: #172033;
    }
    main {
      width: min(760px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 32px;
      border: 1px solid rgba(30, 41, 59, 0.12);
      border-radius: 20px;
      background: #fff;
      box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.2;
    }
    p { margin: 12px 0; }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    pre {
      overflow-x: auto;
      padding: 14px 16px;
      border-radius: 12px;
      background: #0f172a;
      color: #e2e8f0;
    }
    .ok {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #dcfce7;
      color: #166534;
      font-weight: 600;
      font-size: 14px;
    }
    .warn {
      padding: 12px 14px;
      border-radius: 12px;
      background: #fff7ed;
      color: #9a3412;
      border: 1px solid #fed7aa;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #0f172a;
        color: #e5e7eb;
      }
      main {
        background: #111827;
        border-color: rgba(148, 163, 184, 0.22);
        box-shadow: none;
      }
      .ok {
        background: rgba(22, 101, 52, 0.28);
        color: #bbf7d0;
      }
      .warn {
        background: rgba(154, 52, 18, 0.18);
        color: #fed7aa;
        border-color: rgba(251, 146, 60, 0.35);
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="ok">● Flomo MCP Worker is running</div>
    <h1>Flomo MCP Worker</h1>
    <p>这个 Worker 只提供远程 MCP 服务，用于把 ChatGPT / MCP Client 的内容保存到 Flomo。</p>
    <p>根路径是静态提示页，不在浏览器中生成 token，也不会接收或保存你的 Flomo Webhook。</p>

    <h2>Connector URL 格式</h2>
    <pre>https://&lt;worker-domain&gt;/flomo/&lt;URL_TOKEN&gt;/mcp</pre>

    <h2>首次部署推荐流程</h2>
    <pre>npm run deploy:init -- --webhook "https://flomoapp.com/iwh/xxxx"</pre>
    <p>该命令会在本地生成 <code>TOKEN_SECRET</code> 和 <code>URL_TOKEN</code>，并通过 <code>wrangler deploy --secrets-file</code> 一次性部署代码和 Secret。</p>

    <div class="warn">
      完整 Connector URL 等价于可写入 Flomo 的 bearer token。请不要公开；如已泄露，请重新生成 TOKEN_SECRET 和 URL_TOKEN。
    </div>
  </main>
</body>
</html>`;

export function htmlResponse(html = STATIC_HOME_HTML): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

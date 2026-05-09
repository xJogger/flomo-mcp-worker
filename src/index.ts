import { createMcpHandler } from "agents/mcp";

import { isProbablyUrlToken } from "./crypto";
import { htmlResponse } from "./html";
import { createFlomoMcpServer } from "./mcp";
import type { Env } from "./types";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function rewriteToMcpEndpoint(request: Request): Request {
  const rewrittenUrl = new URL(request.url);
  rewrittenUrl.pathname = "/mcp";
  rewrittenUrl.search = "";

  return new Request(rewrittenUrl.toString(), request);
}

function extractEncryptedToken(pathname: string): string | undefined {
  const match = pathname.match(/^\/flomo\/([^/]+)\/mcp\/?$/);
  if (!match) return undefined;
  return decodeURIComponent(match[1]);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return htmlResponse();
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      return jsonResponse({ ok: true, service: "flomo-mcp-worker" });
    }

    const encryptedFlomoToken = extractEncryptedToken(url.pathname);
    if (!encryptedFlomoToken) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (!isProbablyUrlToken(encryptedFlomoToken)) {
      return new Response("Invalid token", {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (!env.TOKEN_SECRET) {
      return new Response("Server misconfigured", {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // The Agents SDK requires a fresh McpServer instance for stateless handlers.
    const server = createFlomoMcpServer({
      env,
      encryptedFlomoToken,
    });

    const mcpRequest = rewriteToMcpEndpoint(request);

    return createMcpHandler(server, {
      route: "/mcp",
      enableJsonResponse: true,
    })(mcpRequest, env, ctx);
  },
} satisfies ExportedHandler<Env>;

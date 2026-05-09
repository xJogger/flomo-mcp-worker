import { beforeAll, describe, expect, it, vi } from "vitest";

import { encryptFlomoWebhookUrl } from "../src/crypto";

vi.mock("agents/mcp", () => ({
  createMcpHandler: () => async () => new Response("mock mcp", { status: 200 }),
}));

const SECRET = "test-secret-with-enough-entropy-123456";
const WEBHOOK = "https://flomoapp.com/iwh/test-webhook-token";

let worker: typeof import("../src/index").default;

beforeAll(async () => {
  worker = (await import("../src/index")).default;
});

function ctx(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
}

describe("Worker routing", () => {
  it("serves a static home page", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/"),
      { TOKEN_SECRET: SECRET },
      ctx(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Flomo MCP Worker is running");
    expect(html).toContain("根路径是静态提示页");
    expect(html).not.toContain("crypto.subtle.encrypt");
  });

  it("serves healthz", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/healthz"),
      { TOKEN_SECRET: SECRET },
      ctx(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "flomo-mcp-worker",
    });
  });

  it("returns 404 for unknown paths", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/unknown"),
      { TOKEN_SECRET: SECRET },
      ctx(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for malformed URL tokens", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/flomo/not-valid/mcp"),
      { TOKEN_SECRET: SECRET },
      ctx(),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Invalid token");
  });

  it("returns 500 when TOKEN_SECRET is missing", async () => {
    const token = await encryptFlomoWebhookUrl(WEBHOOK, SECRET);
    const response = await worker.fetch(
      new Request(`https://example.com/flomo/${token}/mcp`),
      { TOKEN_SECRET: "" },
      ctx(),
    );

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Server misconfigured");
  });

  it("passes valid MCP URLs to the MCP handler", async () => {
    const token = await encryptFlomoWebhookUrl(WEBHOOK, SECRET);
    const response = await worker.fetch(
      new Request(`https://example.com/flomo/${token}/mcp`, { method: "POST" }),
      { TOKEN_SECRET: SECRET },
      ctx(),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("mock mcp");
  });
});

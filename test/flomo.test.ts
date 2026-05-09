import { describe, expect, it, vi } from "vitest";

import { postToFlomo } from "../src/flomo";

const WEBHOOK = "https://flomoapp.com/iwh/test-webhook-token";

describe("postToFlomo", () => {
  it("posts Markdown content to Flomo", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("ok", { status: 200 }),
    );

    const result = await postToFlomo({
      webhookUrl: WEBHOOK,
      content: "hello #test",
      contentType: "markdown",
      fetchFn,
    });

    expect(result).toEqual({ ok: true, status: 200, responseText: "ok" });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchFn.mock.calls[0];
    expect(calledUrl).toBe(WEBHOOK);
    expect(calledInit).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(calledInit?.body))).toEqual({
      content: "hello #test",
      content_type: "markdown",
    });
  });

  it("returns structured failure for non-2xx responses", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("bad webhook", { status: 401, statusText: "Unauthorized" }),
    );

    const result = await postToFlomo({
      webhookUrl: WEBHOOK,
      content: "hello",
      contentType: "text",
      fetchFn,
    });

    expect(result).toEqual({ ok: false, status: 401, message: "bad webhook" });
  });

  it("truncates long failure responses", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response("x".repeat(600), { status: 500 }),
    );

    const result = await postToFlomo({
      webhookUrl: WEBHOOK,
      content: "hello",
      contentType: "markdown",
      fetchFn,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toHaveLength(501);
      expect(result.message.endsWith("…")).toBe(true);
    }
  });

  it("returns network errors as failures", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new Error("network down");
    });

    const result = await postToFlomo({
      webhookUrl: WEBHOOK,
      content: "hello",
      contentType: "markdown",
      fetchFn,
    });

    expect(result).toEqual({ ok: false, status: 0, message: "network down" });
  });
});

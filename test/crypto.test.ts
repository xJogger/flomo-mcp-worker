import { describe, expect, it } from "vitest";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptFlomoWebhookUrl,
  encryptFlomoWebhookUrl,
  isProbablyUrlToken,
  validateFlomoWebhookUrl,
} from "../src/crypto";

const WEBHOOK = "https://flomoapp.com/iwh/test-webhook-token";
const SECRET = "test-secret-with-enough-entropy-123456";

describe("base64url helpers", () => {
  it("round-trips bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = bytesToBase64Url(bytes);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(Array.from(base64UrlToBytes(encoded))).toEqual(Array.from(bytes));
  });

  it("rejects invalid base64url characters", () => {
    expect(() => base64UrlToBytes("abc+def")).toThrow("Invalid token encoding");
  });
});

describe("flomo webhook validation", () => {
  it("accepts flomo webhook URL", () => {
    expect(validateFlomoWebhookUrl(WEBHOOK)).toBe(WEBHOOK);
  });

  it("rejects non-HTTPS URLs", () => {
    expect(() => validateFlomoWebhookUrl("http://flomoapp.com/iwh/abc")).toThrow(
      "HTTPS",
    );
  });

  it("rejects non-Flomo hosts", () => {
    expect(() => validateFlomoWebhookUrl("https://evil.example/iwh/abc")).toThrow(
      "flomoapp.com",
    );
  });

  it("rejects invalid paths", () => {
    expect(() => validateFlomoWebhookUrl("https://flomoapp.com/not-iwh/abc")).toThrow(
      "/iwh/",
    );
  });

  it("rejects missing webhook token", () => {
    expect(() => validateFlomoWebhookUrl("https://flomoapp.com/iwh/")).toThrow(
      "/iwh/",
    );
  });
});

describe("URL token encryption", () => {
  it("encrypts and decrypts a Flomo webhook URL", async () => {
    const token = await encryptFlomoWebhookUrl(WEBHOOK, SECRET);

    expect(isProbablyUrlToken(token)).toBe(true);
    await expect(decryptFlomoWebhookUrl(token, SECRET)).resolves.toBe(WEBHOOK);
  });

  it("fails with a wrong secret", async () => {
    const token = await encryptFlomoWebhookUrl(WEBHOOK, SECRET);

    await expect(decryptFlomoWebhookUrl(token, "wrong-secret-with-enough-length")).rejects.toThrow(
      "Invalid URL token or TOKEN_SECRET",
    );
  });

  it("rejects short or malformed tokens", async () => {
    await expect(decryptFlomoWebhookUrl("short", SECRET)).rejects.toThrow("Invalid URL token");
    await expect(decryptFlomoWebhookUrl("abc+def+ghi+that-is-invalid", SECRET)).rejects.toThrow(
      "Invalid URL token",
    );
  });
});

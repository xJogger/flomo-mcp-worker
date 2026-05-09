import { randomBytes, webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];

    if (!item.startsWith("--")) {
      if (!args._) args._ = [];
      args._.push(item);
      continue;
    }

    const eqIndex = item.indexOf("=");
    if (eqIndex !== -1) {
      args[item.slice(2, eqIndex)] = item.slice(eqIndex + 1);
      continue;
    }

    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

export function bytesToBase64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateTokenSecret() {
  return bytesToBase64Url(randomBytes(32));
}

export function validateFlomoWebhookUrl(raw) {
  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("Flomo Webhook URL 不是合法 URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Flomo Webhook URL 必须使用 https");
  }

  if (url.hostname !== "flomoapp.com") {
    throw new Error("Flomo Webhook URL hostname 必须是 flomoapp.com");
  }

  if (!url.pathname.startsWith("/iwh/") || url.pathname.length <= "/iwh/".length) {
    throw new Error("Flomo Webhook URL path 必须以 /iwh/ 开头");
  }

  if (url.username || url.password) {
    throw new Error("Flomo Webhook URL 不能包含用户名或密码");
  }

  return url.toString();
}

async function deriveAesKey(tokenSecret, usages) {
  if (!tokenSecret || tokenSecret.trim().length < 16) {
    throw new Error("TOKEN_SECRET 为空或太短，至少需要 16 个字符");
  }

  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(tokenSecret),
  );

  return subtle.importKey("raw", digest, { name: "AES-GCM" }, false, usages);
}

export async function encryptFlomoWebhookUrl(flomoWebhookUrl, tokenSecret) {
  const normalizedWebhookUrl = validateFlomoWebhookUrl(flomoWebhookUrl);
  const key = await deriveAesKey(tokenSecret, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));

  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(normalizedWebhookUrl),
    ),
  );

  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);

  return bytesToBase64Url(packed);
}

export function normalizeOrigin(origin) {
  if (!origin) return undefined;

  const url = new URL(origin);
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

export function buildConnectorUrl(origin, urlToken) {
  return `${normalizeOrigin(origin)}/flomo/${urlToken}/mcp`;
}

export function printTokenResult({ tokenSecret, urlToken, origin }) {
  console.log("");
  console.log("TOKEN_SECRET（请保存到安全位置；部署时会写入 Cloudflare Secret）:");
  console.log(tokenSecret);
  console.log("");
  console.log("URL_TOKEN:");
  console.log(urlToken);
  console.log("");

  if (origin) {
    console.log("Connector URL:");
    console.log(buildConnectorUrl(origin, urlToken));
  } else {
    console.log("部署后把 Worker URL 和 URL_TOKEN 拼成：");
    console.log(`https://<worker-domain>/flomo/${urlToken}/mcp`);
  }

  console.log("");
  console.log("Cloudflare Secret 文件内容示例：");
  console.log(JSON.stringify({ TOKEN_SECRET: tokenSecret }, null, 2));
  console.log("");
}

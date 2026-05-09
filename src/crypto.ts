const TOKEN_MIN_LENGTH = 32;
const TOKEN_MAX_LENGTH = 8192;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export function isProbablyUrlToken(token: string): boolean {
  return (
    token.length >= TOKEN_MIN_LENGTH &&
    token.length <= TOKEN_MAX_LENGTH &&
    BASE64URL_RE.test(token)
  );
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlToBytes(input: string): Uint8Array {
  if (!input || !BASE64URL_RE.test(input)) {
    throw new Error("Invalid token encoding");
  }

  let normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  if (pad) normalized += "=".repeat(4 - pad);

  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveAesKey(
  tokenSecret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  if (!tokenSecret || tokenSecret.trim().length < 16) {
    throw new Error("TOKEN_SECRET is missing or too short");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(tokenSecret),
  );

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    usages,
  );
}

export function validateFlomoWebhookUrl(raw: string): string {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid Flomo webhook URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Flomo webhook URL must use HTTPS");
  }

  if (url.hostname !== "flomoapp.com") {
    throw new Error("Flomo webhook host must be flomoapp.com");
  }

  if (!url.pathname.startsWith("/iwh/") || url.pathname.length <= "/iwh/".length) {
    throw new Error("Flomo webhook path must start with /iwh/");
  }

  if (url.username || url.password) {
    throw new Error("Flomo webhook URL must not include credentials");
  }

  return url.toString();
}

export async function encryptFlomoWebhookUrl(
  flomoWebhookUrl: string,
  tokenSecret: string,
): Promise<string> {
  const normalizedWebhookUrl = validateFlomoWebhookUrl(flomoWebhookUrl);
  const key = await deriveAesKey(tokenSecret, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(normalizedWebhookUrl);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );

  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);

  return bytesToBase64Url(packed);
}

export async function decryptFlomoWebhookUrl(
  encryptedToken: string,
  tokenSecret: string,
): Promise<string> {
  if (!isProbablyUrlToken(encryptedToken)) {
    throw new Error("Invalid URL token");
  }

  const packed = base64UrlToBytes(encryptedToken);

  // AES-GCM payload = 12-byte IV + ciphertext + 16-byte auth tag.
  if (packed.length <= 12 + 16) {
    throw new Error("Invalid URL token");
  }

  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const key = await deriveAesKey(tokenSecret, ["decrypt"]);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("Invalid URL token or TOKEN_SECRET");
  }

  const flomoWebhookUrl = new TextDecoder().decode(plaintext);
  return validateFlomoWebhookUrl(flomoWebhookUrl);
}

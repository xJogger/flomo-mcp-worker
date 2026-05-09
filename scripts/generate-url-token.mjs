#!/usr/bin/env node

import {
  encryptFlomoWebhookUrl,
  generateTokenSecret,
  normalizeOrigin,
  parseArgs,
  printTokenResult,
} from "./token-utils.mjs";

function usage() {
  console.log(`用法：

  npm run token -- --webhook "https://flomoapp.com/iwh/xxxx"

可选参数：

  --secret "已有 TOKEN_SECRET"
  --origin "https://your-worker.workers.dev"

示例：

  npm run token -- \\
    --webhook "https://flomoapp.com/iwh/xxxx" \\
    --origin "https://flomo-mcp-worker.yourname.workers.dev"
`);
}

async function main() {
  const args = parseArgs();

  if (args.help || args.h) {
    usage();
    return;
  }

  const webhook = args.webhook;
  if (!webhook || webhook === true) {
    usage();
    process.exitCode = 1;
    return;
  }

  const tokenSecret =
    args.secret && args.secret !== true ? String(args.secret) : generateTokenSecret();
  const urlToken = await encryptFlomoWebhookUrl(String(webhook), tokenSecret);
  const origin = args.origin && args.origin !== true ? normalizeOrigin(String(args.origin)) : undefined;

  printTokenResult({ tokenSecret, urlToken, origin });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

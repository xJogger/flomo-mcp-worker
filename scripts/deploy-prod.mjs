#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  buildConnectorUrl,
  encryptFlomoWebhookUrl,
  generateTokenSecret,
  normalizeOrigin,
  parseArgs,
} from "./token-utils.mjs";

function usage() {
  console.log(`用法：

  npm run deploy:init -- --webhook "https://flomoapp.com/iwh/xxxx"

可选参数：

  --secret "已有 TOKEN_SECRET"       使用已有 secret；不传则自动生成
  --origin "https://worker.example"  指定 Worker origin；不传则尝试从 wrangler 输出解析

说明：

  这个命令会先在本地生成 TOKEN_SECRET 和 URL_TOKEN，
  然后用 wrangler deploy --secrets-file 一次性部署代码和 Secret。
`);
}

async function askWebhook() {
  if (!process.stdin.isTTY) return undefined;

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("请输入 Flomo Webhook URL: ");
    return answer.trim() || undefined;
  } finally {
    rl.close();
  }
}

async function runWranglerDeploy(secretsFile) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(command, ["wrangler", "deploy", "--secrets-file", secretsFile], {
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text);
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`wrangler deploy failed with exit code ${exitCode}`);
  }

  return { stdout, stderr };
}

function extractWorkersDevOrigin(outputText) {
  const match = outputText.match(/https:\/\/[A-Za-z0-9.-]+\.workers\.dev\b/);
  return match?.[0];
}

async function main() {
  const args = parseArgs();

  if (args.help || args.h) {
    usage();
    return;
  }

  const webhook =
    args.webhook && args.webhook !== true ? String(args.webhook) : await askWebhook();

  if (!webhook) {
    usage();
    process.exitCode = 1;
    return;
  }

  const tokenSecret =
    args.secret && args.secret !== true ? String(args.secret) : generateTokenSecret();
  const urlToken = await encryptFlomoWebhookUrl(webhook, tokenSecret);
  const requestedOrigin =
    args.origin && args.origin !== true ? normalizeOrigin(String(args.origin)) : undefined;

  const tempDir = await mkdtemp(join(tmpdir(), "flomo-mcp-secrets-"));
  const secretsFile = join(tempDir, "secrets.json");

  try {
    await writeFile(
      secretsFile,
      `${JSON.stringify({ TOKEN_SECRET: tokenSecret }, null, 2)}\n`,
      { mode: 0o600 },
    );

    console.log("已在本地生成 TOKEN_SECRET 和 URL_TOKEN。");
    console.log("正在执行：npx wrangler deploy --secrets-file <temp-secrets-file>");
    console.log("");

    const { stdout, stderr } = await runWranglerDeploy(secretsFile);
    const detectedOrigin = extractWorkersDevOrigin(`${stdout}\n${stderr}`);
    const origin = requestedOrigin || detectedOrigin;

    console.log("");
    console.log("部署完成。临时 secrets 文件已删除。请把下面信息保存到安全位置。");
    console.log("");
    console.log("TOKEN_SECRET:");
    console.log(tokenSecret);
    console.log("");
    console.log("URL_TOKEN:");
    console.log(urlToken);
    console.log("");

    if (origin) {
      console.log("Connector URL:");
      console.log(buildConnectorUrl(origin, urlToken));
    } else {
      console.log("未能从 wrangler 输出中识别 Worker URL。请手动拼接：");
      console.log(`https://<worker-domain>/flomo/${urlToken}/mcp`);
    }

    console.log("");
    console.log("安全提醒：完整 Connector URL 泄露后，别人仍可通过该 Worker 写入你的 Flomo。");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

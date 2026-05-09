import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { decryptFlomoWebhookUrl } from "./crypto";
import { postToFlomo } from "./flomo";
import type { Env, FlomoContentType } from "./types";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createFlomoMcpServer(args: {
  env: Env;
  encryptedFlomoToken: string;
}): McpServer {
  const { env, encryptedFlomoToken } = args;

  const server = new McpServer({
    name: "flomo-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "save_to_flomo",
    {
      title: "Save to Flomo",
      description:
        "Save a note, thought, link, Markdown snippet, or tagged memo to Flomo.",
      inputSchema: {
        content: z
          .string()
          .min(1)
          .max(100_000)
          .describe("The note content to save to Flomo."),
        content_type: z
          .enum(["markdown", "text"])
          .default("markdown")
          .describe("Use markdown for formatted notes and tags; use text for plain text."),
      },
    },
    async ({ content, content_type }) => {
      try {
        const flomoWebhookUrl = await decryptFlomoWebhookUrl(
          encryptedFlomoToken,
          env.TOKEN_SECRET,
        );

        const result = await postToFlomo({
          webhookUrl: flomoWebhookUrl,
          content,
          contentType: (content_type ?? "markdown") as FlomoContentType,
        });

        if (!result.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: `保存失败。Flomo 返回 HTTP ${result.status}: ${result.message}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: "已保存到 Flomo。",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `保存失败：${formatError(error)}`,
            },
          ],
        };
      }
    },
  );

  return server;
}

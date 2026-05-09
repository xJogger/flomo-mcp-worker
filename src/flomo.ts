import type { FlomoContentType } from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_PREVIEW_LENGTH = 500;

export type SaveToFlomoResult =
  | {
      ok: true;
      status: number;
      responseText: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function truncate(input: string, maxLength = MAX_RESPONSE_PREVIEW_LENGTH): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}…`;
}

export async function postToFlomo(args: {
  webhookUrl: string;
  content: string;
  contentType: FlomoContentType;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}): Promise<SaveToFlomoResult> {
  const {
    webhookUrl,
    content,
    contentType,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchFn = fetch,
  } = args;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        content_type: contentType,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: truncate(responseText || response.statusText || "Flomo request failed"),
      };
    }

    return {
      ok: true,
      status: response.status,
      responseText: truncate(responseText),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

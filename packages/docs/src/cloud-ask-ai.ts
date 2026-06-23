import { emitDocsAnalyticsEvent } from "./analytics.js";
import type { AIConfig, DocsAnalyticsConfig, DocsCloudConfig } from "./types.js";

const DEFAULT_DOCS_CLOUD_API_BASE_URL = "https://api.farming-labs.dev";
const DEFAULT_DOCS_CLOUD_API_KEY_ENV = "DOCS_CLOUD_API_KEY";
const DOCS_CLOUD_PROJECT_ID_ENVS = [
  "PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "DOCS_CLOUD_PROJECT_ID",
  "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
] as const;
const DOCS_CLOUD_API_BASE_URL_ENVS = [
  "DOCS_CLOUD_API_BASE_URL",
  "DOCS_CLOUD_API_URL",
  "PUBLIC_DOCS_CLOUD_URL",
  "NEXT_PUBLIC_DOCS_CLOUD_URL",
] as const;
const DOCS_CLOUD_FOOTER_GUARD_CHARS = 256;
const docsCloudRelevantDocsPattern =
  /\n{2,}(?:-{3,}|\*{3,}|_{3,})[ \t]*\n{1,3}(?:\*\*)?Relevant docs(?:\*\*)?[ \t]*/i;

export interface DocsCloudAskAIConfig {
  ai?: Pick<AIConfig, "docsUrl" | "enabled" | "provider" | "stream">;
  analytics?: boolean | DocsAnalyticsConfig;
  cloud?: DocsCloudConfig;
}

export interface DocsCloudAskAIResponseOptions {
  config?: DocsCloudAskAIConfig;
  /**
   * Runtime env map for frameworks that expose environment variables outside
   * `process.env`, for example SvelteKit's `$env/dynamic/private`.
   */
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  publicBaseUrl?: string;
  locale?: string;
}

interface DocsChatMessage {
  role?: unknown;
  content?: unknown;
}

interface DocsChatBody {
  messages?: DocsChatMessage[];
  model?: unknown;
  question?: unknown;
  stream?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnv(name: string, env?: Record<string, string | undefined>): string | undefined {
  const value = env?.[name] ?? (typeof process !== "undefined" ? process.env?.[name] : undefined);
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readFirstEnv(
  names: readonly string[],
  env?: Record<string, string | undefined>,
): string | undefined {
  for (const name of names) {
    const value = readEnv(name, env);
    if (value) return value;
  }
}

function resolveDocsCloudApiBaseUrl(env?: Record<string, string | undefined>): string {
  return (
    readFirstEnv(DOCS_CLOUD_API_BASE_URL_ENVS, env) ?? DEFAULT_DOCS_CLOUD_API_BASE_URL
  ).replace(/\/+$/, "");
}

function resolveDocsCloudProjectId(env?: Record<string, string | undefined>): string | undefined {
  return readFirstEnv(DOCS_CLOUD_PROJECT_ID_ENVS, env);
}

function resolveDocsCloudApiKey(
  cloudConfig: DocsCloudConfig | undefined,
  env?: Record<string, string | undefined>,
): { envName: string; apiKey: string | undefined } {
  const envName = cloudConfig?.apiKey?.env?.trim() || DEFAULT_DOCS_CLOUD_API_KEY_ENV;
  return { envName, apiKey: readEnv(envName, env) };
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function textFromMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!isPlainObject(part)) return "";
      if (typeof part.text === "string") return part.text;
      if (typeof part.content === "string") return part.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function lastUserQuestion(messages: DocsChatMessage[] | undefined): string {
  if (!Array.isArray(messages)) return "";

  const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user");
  return textFromMessageContent(lastUserMessage?.content).trim();
}

function resolveQuestion(body: DocsChatBody): string {
  return typeof body.question === "string" && body.question.trim()
    ? body.question.trim()
    : lastUserQuestion(body.messages);
}

function shouldStreamResponse(
  request: Request,
  body: DocsChatBody,
  aiConfig?: DocsCloudAskAIConfig["ai"],
) {
  if (typeof body.stream === "boolean") return body.stream;
  if (aiConfig?.stream === false) return false;

  const accept = request.headers.get("accept")?.toLowerCase();
  return !accept || accept.includes("text/event-stream") || accept.includes("*/*");
}

function stripRelevantDocsFooter(content: string): string {
  return content
    .replace(new RegExp(`${docsCloudRelevantDocsPattern.source}[\\s\\S]*$`, "i"), "")
    .trimEnd();
}

function safeDocsCloudContent(content: string, final = false): string {
  const footerStart = content.search(docsCloudRelevantDocsPattern);
  if (footerStart >= 0) return content.slice(0, footerStart).trimEnd();
  if (final) return stripRelevantDocsFooter(content);
  return content.slice(0, Math.max(0, content.length - DOCS_CLOUD_FOOTER_GUARD_CHARS));
}

function createOpenAICompatibleSseChunk(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function createOpenAICompatibleSseResponse(content: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (content) controller.enqueue(encoder.encode(createOpenAICompatibleSseChunk(content)));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function openAICompatibleDeltaContent(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  const firstChoice = Array.isArray(value.choices) ? value.choices[0] : undefined;
  if (!isPlainObject(firstChoice) || !isPlainObject(firstChoice.delta)) return undefined;
  return typeof firstChoice.delta.content === "string" ? firstChoice.delta.content : undefined;
}

function docsCloudStreamContent(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isPlainObject(value)) return undefined;

  for (const key of ["content", "text", "answer", "delta"]) {
    const content = value[key];
    if (typeof content === "string") return content;
  }

  return undefined;
}

function docsCloudAnswerFromPayload(payload: unknown): string {
  if (!isPlainObject(payload)) return "";
  for (const key of ["answer", "text", "content"]) {
    const content = payload[key];
    if (typeof content === "string") return content;
  }
  return "";
}

function createCleanDocsCloudSseResponse(upstream: Response): Response {
  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": upstream.headers.get("Cache-Control") ?? "no-cache, no-transform",
        Connection: upstream.headers.get("Connection") ?? "keep-alive",
      },
    });
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      let content = "";
      let emittedLength = 0;

      const enqueue = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      const emitSafeContent = (final = false) => {
        const safeContent = safeDocsCloudContent(content, final);
        if (safeContent.length <= emittedLength) return;

        enqueue(createOpenAICompatibleSseChunk(safeContent.slice(emittedLength)));
        emittedLength = safeContent.length;
      };

      const flushEvent = (event: string) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trim())
          .filter(Boolean)
          .join("\n")
          .trim();

        if (!data) return;
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as unknown;
          const delta = openAICompatibleDeltaContent(parsed) ?? docsCloudStreamContent(parsed);
          if (delta) {
            content += delta;
            emitSafeContent();
          }
        } catch {
          content += data;
          emitSafeContent();
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";
          for (const event of events) flushEvent(event);
        }

        buffer += decoder.decode();
        if (buffer.trim()) flushEvent(buffer);
      } catch {
        // Finalize with whatever clean answer content arrived before the upstream closed.
      }

      emitSafeContent(true);
      enqueue("data: [DONE]\n\n");
      controller.close();
    },
  });

  return new Response(stream, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": upstream.headers.get("Cache-Control") ?? "no-cache, no-transform",
      Connection: upstream.headers.get("Connection") ?? "keep-alive",
    },
  });
}

function analyticsProperties(request: Request): Record<string, unknown> {
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent ? { userAgent } : {};
}

export function isDocsCloudAskAIProvider(
  config: Pick<AIConfig, "enabled" | "provider"> | undefined,
) {
  return config?.enabled === true && config.provider === "docs-cloud";
}

export async function createDocsCloudAskAIResponse(
  request: Request,
  options: DocsCloudAskAIResponseOptions = {},
): Promise<Response> {
  const config = options.config;
  const aiConfig = config?.ai;
  const analytics = config?.analytics;
  const requestUrl = new URL(request.url);
  const requestStartedAt = Date.now();
  const requestProperties = analyticsProperties(request);

  let body: DocsChatBody;
  try {
    body = (await request.json()) as DocsChatBody;
  } catch {
    await emitDocsAnalyticsEvent(analytics, {
      type: "api_ai_error",
      source: "server",
      url: request.url,
      path: requestUrl.pathname,
      locale: options.locale,
      properties: {
        ...requestProperties,
        reason: "invalid_json",
        provider: "docs-cloud",
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      },
    });
    return jsonError("Invalid JSON body. Expected { messages: [...] }.", 400);
  }

  const question = resolveQuestion(body);
  const messages = Array.isArray(body.messages) ? body.messages : undefined;
  if (!question) {
    await emitDocsAnalyticsEvent(analytics, {
      type: "api_ai_error",
      source: "server",
      url: request.url,
      path: requestUrl.pathname,
      locale: options.locale,
      properties: {
        ...requestProperties,
        reason: "missing_user_message",
        provider: "docs-cloud",
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      },
    });
    return jsonError("At least one user message is required.", 400);
  }

  const projectId = resolveDocsCloudProjectId(options.env);
  const { envName, apiKey } = resolveDocsCloudApiKey(config?.cloud, options.env);
  if (!projectId || !apiKey) {
    const reason = !projectId ? "missing_docs_cloud_project_id" : "missing_docs_cloud_api_key";
    await emitDocsAnalyticsEvent(analytics, {
      type: "api_ai_error",
      source: "server",
      url: request.url,
      path: requestUrl.pathname,
      locale: options.locale,
      input: { question },
      properties: {
        ...requestProperties,
        reason,
        provider: "docs-cloud",
        envName: !apiKey ? envName : undefined,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      },
    });

    return jsonError(
      !projectId
        ? `Docs Cloud Ask AI is missing ${DOCS_CLOUD_PROJECT_ID_ENVS.join(" or ")}. Add the project id to the deployment environment.`
        : `Docs Cloud Ask AI is missing ${envName}. Add it to the deployment environment.`,
      500,
    );
  }

  const stream = shouldStreamResponse(request, body, aiConfig);
  const apiBaseUrl = resolveDocsCloudApiBaseUrl(options.env);
  const publicBaseUrl = aiConfig?.docsUrl ?? options.publicBaseUrl ?? requestUrl.origin;
  const requestedModel =
    typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined;

  await emitDocsAnalyticsEvent(analytics, {
    type: "api_ai_request",
    source: "server",
    url: request.url,
    path: requestUrl.pathname,
    locale: options.locale,
    input: { question },
    properties: {
      ...requestProperties,
      provider: "docs-cloud",
      messageCount: messages?.length,
      questionLength: question.length,
      model: requestedModel ?? "docs-cloud",
    },
  });

  let upstream: Response;
  try {
    upstream = await (options.fetch ?? fetch)(
      `${apiBaseUrl}/v1/projects/${encodeURIComponent(projectId)}/knowledge/ask`,
      {
        method: "POST",
        headers: {
          Accept: stream ? "text/event-stream, application/json" : "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Docs-Cloud-Public-Base-Url": publicBaseUrl,
        },
        body: JSON.stringify({
          messages,
          question,
          answerMode: "auto",
          answerStyle: "public",
          modelPreference: requestedModel,
          stream,
          publicBaseUrl,
        }),
      },
    );
  } catch {
    await emitDocsAnalyticsEvent(analytics, {
      type: "api_ai_error",
      source: "server",
      url: request.url,
      path: requestUrl.pathname,
      locale: options.locale,
      input: { question },
      properties: {
        ...requestProperties,
        reason: "docs_cloud_fetch_error",
        provider: "docs-cloud",
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      },
    });
    return jsonError("Docs Cloud Ask AI request failed.", 502);
  }

  if (!upstream.ok) {
    await upstream.text().catch(() => "");
    await emitDocsAnalyticsEvent(analytics, {
      type: "api_ai_error",
      source: "server",
      url: request.url,
      path: requestUrl.pathname,
      locale: options.locale,
      input: { question },
      properties: {
        ...requestProperties,
        reason: "docs_cloud_error",
        provider: "docs-cloud",
        status: upstream.status,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
      },
    });
    return jsonError(`Docs Cloud Ask AI error (${upstream.status}).`, 502);
  }

  await emitDocsAnalyticsEvent(analytics, {
    type: "api_ai_response",
    source: "server",
    url: request.url,
    path: requestUrl.pathname,
    locale: options.locale,
    input: { question },
    properties: {
      ...requestProperties,
      provider: "docs-cloud",
      status: upstream.status,
      durationMs: Math.max(0, Date.now() - requestStartedAt),
    },
  });

  const contentType = upstream.headers.get("Content-Type") ?? "";
  if (stream && contentType.includes("text/event-stream")) {
    return createCleanDocsCloudSseResponse(upstream);
  }

  const upstreamBody = await upstream.text();
  let payload: unknown;
  let answer = upstreamBody;
  try {
    payload = JSON.parse(upstreamBody) as unknown;
    answer = docsCloudAnswerFromPayload(payload) || answer;
  } catch {
    // Treat non-JSON Docs Cloud responses as the answer text.
  }

  const cleanAnswer = stripRelevantDocsFooter(answer);
  if (stream) return createOpenAICompatibleSseResponse(cleanAnswer);

  return Response.json(
    isPlainObject(payload) ? { ...payload, answer: cleanAnswer } : { answer: cleanAnswer },
  );
}

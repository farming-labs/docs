import type { DocsTelemetryEvent } from "@farming-labs/docs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_TELEMETRY_BODY_BYTES = 32_768;
const TELEMETRY_RATE_LIMIT_WINDOW_MS = 60_000;
const TELEMETRY_GLOBAL_RATE_LIMIT_MAX_REQUESTS = 2_000;
const TELEMETRY_IDENTITY_RATE_LIMIT_MAX_REQUESTS = 120;
const TELEMETRY_RATE_LIMIT_MAX_KEYS = 4_096;

interface TelemetryRateLimitEntry {
  count: number;
  resetAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown, { max }: { max: number }) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed.slice(0, max);
}

function readNestedRecord(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const next = value[key];
  return isRecord(next) ? next : undefined;
}

function isPrismaSchemaMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isPrismaUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError;
}

function getRateLimitStore() {
  const globalValue = globalThis as typeof globalThis & {
    __farmingLabsDocsTelemetryRateLimit__?: Map<string, TelemetryRateLimitEntry>;
  };

  globalValue.__farmingLabsDocsTelemetryRateLimit__ ??= new Map();
  return globalValue.__farmingLabsDocsTelemetryRateLimit__;
}

function readBearerToken(value: string | null) {
  if (!value) return undefined;

  const [scheme, token] = value.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer") return undefined;

  return readString(token, { max: 512 });
}

function readTelemetryIngestKey(request: Request) {
  return (
    readString(request.headers.get("x-docs-telemetry-key"), { max: 512 }) ??
    readBearerToken(request.headers.get("authorization"))
  );
}

function hasValidTelemetryIngestKey(request: Request) {
  const requiredKey = readString(process.env.DOCS_TELEMETRY_INGEST_KEY, { max: 512 });
  if (!requiredKey) return true;

  return readTelemetryIngestKey(request) === requiredKey;
}

function pruneExpiredRateLimitEntries(store: Map<string, TelemetryRateLimitEntry>, now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function trimRateLimitStore(store: Map<string, TelemetryRateLimitEntry>) {
  while (store.size >= TELEMETRY_RATE_LIMIT_MAX_KEYS) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) return;
    store.delete(oldestKey);
  }
}

function isTelemetryRateLimited(key: string, maxRequests: number) {
  const now = Date.now();
  const store = getRateLimitStore();
  pruneExpiredRateLimitEntries(store, now);

  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    if (current) {
      store.delete(key);
    }

    trimRateLimitStore(store);

    store.set(key, {
      count: 1,
      resetAt: now + TELEMETRY_RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (current.count >= maxRequests) return true;

  current.count += 1;
  return false;
}

function createTelemetryIdentityRateLimitKey(
  eventBody: Record<string, unknown>,
  eventType: string,
) {
  const packageInfo = readNestedRecord(eventBody, "package");
  const site = readNestedRecord(eventBody, "site");
  const deployment = readNestedRecord(eventBody, "deployment");

  const packageName = readString(packageInfo?.name, { max: 120 });
  const packageVersion = readString(packageInfo?.version, { max: 80 });
  const framework = readString(eventBody.framework, { max: 80 });
  const siteOrigin = readString(site?.origin, { max: 512 });
  const deploymentId = readString(deployment?.id, { max: 160 });
  const deploymentProvider = readString(deployment?.provider, { max: 80 });
  const deploymentEnvironment = readString(deployment?.environment, { max: 120 });
  const deploymentKey =
    deploymentId ??
    (deploymentProvider || deploymentEnvironment
      ? `${deploymentProvider ?? ""}:${deploymentEnvironment ?? ""}`
      : undefined);
  const stableIdentity = siteOrigin ?? deploymentKey;

  if (!packageName || !packageVersion || !stableIdentity) return undefined;

  return ["identity", packageName, packageVersion, eventType, framework ?? "", stableIdentity].join(
    "|",
  );
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_TELEMETRY_BODY_BYTES) {
      return NextResponse.json({ error: "Telemetry body is too large" }, { status: 413 });
    }

    if (!hasValidTelemetryIngestKey(request)) {
      return NextResponse.json({ error: "Telemetry ingest key is invalid" }, { status: 401 });
    }

    if (isTelemetryRateLimited("global", TELEMETRY_GLOBAL_RATE_LIMIT_MAX_REQUESTS)) {
      return NextResponse.json({ error: "Telemetry rate limit exceeded" }, { status: 429 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          ok: true,
          stored: false,
          warning: "Telemetry database not configured",
        },
        { status: 202 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Telemetry body must be valid JSON" }, { status: 400 });
    }

    const eventBody = isRecord(body) && isRecord(body.event) ? body.event : body;
    if (!isRecord(eventBody)) {
      return NextResponse.json({ error: "Telemetry event must be an object" }, { status: 400 });
    }

    const eventType = readString(eventBody.type, { max: 80 });
    if (!eventType) {
      return NextResponse.json({ error: "Telemetry event type is required" }, { status: 400 });
    }

    const identityRateLimitKey = createTelemetryIdentityRateLimitKey(eventBody, eventType);
    if (
      identityRateLimitKey &&
      isTelemetryRateLimited(identityRateLimitKey, TELEMETRY_IDENTITY_RATE_LIMIT_MAX_REQUESTS)
    ) {
      return NextResponse.json({ error: "Telemetry rate limit exceeded" }, { status: 429 });
    }

    const packageInfo = readNestedRecord(eventBody, "package");
    const runtime = readNestedRecord(eventBody, "runtime");
    const site = readNestedRecord(eventBody, "site");
    const deployment = readNestedRecord(eventBody, "deployment");
    const features = readNestedRecord(eventBody, "features");
    const properties = readNestedRecord(eventBody, "properties");

    const event = eventBody as unknown as DocsTelemetryEvent;

    try {
      const entry = await prisma.docsTelemetryEvent.create({
        data: {
          eventType,
          packageName: readString(packageInfo?.name, { max: 120 }),
          packageVersion: readString(packageInfo?.version, { max: 80 }),
          framework: readString(event.framework, { max: 80 }),
          runtimeName: readString(runtime?.name, { max: 80 }),
          siteOrigin: readString(site?.origin, { max: 512 }),
          deploymentProvider: readString(deployment?.provider, { max: 80 }),
          deploymentEnvironment: readString(deployment?.environment, { max: 120 }),
          deploymentId: readString(deployment?.id, { max: 160 }),
          features: features as unknown as Prisma.InputJsonValue,
          properties: properties as unknown as Prisma.InputJsonValue,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({ ok: true, stored: true, id: entry.id }, { status: 201 });
    } catch (error) {
      if (isPrismaSchemaMissing(error)) {
        console.warn(
          "[telemetry POST] DocsTelemetryEvent schema or Prisma client is out of date. Run `pnpm --dir website exec prisma generate` and `pnpm --dir website exec prisma db push` to sync it.",
        );

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "Telemetry schema or Prisma client is out of date",
          },
          { status: 202 },
        );
      }

      if (isPrismaUnavailable(error)) {
        console.warn(
          "[telemetry POST] Telemetry database is currently unreachable. Returning a non-blocking response.",
        );

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "Telemetry database unreachable",
          },
          { status: 202 },
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[telemetry POST]", error);

    return NextResponse.json({ error: "Failed to store docs telemetry" }, { status: 500 });
  }
}

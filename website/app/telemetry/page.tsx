import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Activity, AlertTriangle, Database, Fingerprint, Globe2 } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Usage metrics",
  description: "Internal usage metrics overview for @farming-labs/docs.",
};

type TelemetrySearchParams = Promise<Record<string, string | string[] | undefined>>;

type TelemetryPageProps = {
  searchParams?: TelemetrySearchParams;
};

type GroupCount = {
  key: string;
  count: number;
  lastSeenAt?: Date | null;
};

type RawGroupCount = {
  key: string | null;
  count: number | bigint;
  lastSeenAt: Date | null;
};

type RecentTelemetryEvent = {
  id: string;
  eventType: string;
  identityHash: string | null;
  packageName: string | null;
  packageVersion: string | null;
  framework: string | null;
  runtimeName: string | null;
  siteOrigin: string | null;
  deploymentProvider: string | null;
  deploymentEnvironment: string | null;
  deploymentId: string | null;
  properties: Prisma.JsonValue | null;
  createdAt: Date;
};

type TelemetryData =
  | {
      status: "ready";
      totalEvents: number;
      eventsLast24h: number;
      uniqueIdentities: number;
      uniqueSites: number;
      recentEvents: RecentTelemetryEvent[];
      eventTypes: GroupCount[];
      frameworks: GroupCount[];
      packageVersions: GroupCount[];
      deploymentProviders: GroupCount[];
      topSites: GroupCount[];
      topIdentities: GroupCount[];
      featureFlags: GroupCount[];
      agentSurfaces: GroupCount[];
    }
  | {
      status: "not-configured" | "schema-missing" | "unavailable";
      message: string;
    };

function readFirst(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function readLimit(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(readFirst(value) ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 500);
}

function readDashboardToken(): string | undefined {
  const token = process.env.DOCS_TELEMETRY_DASHBOARD_TOKEN?.trim();
  return token || undefined;
}

function assertDashboardAccess(searchParams: Record<string, string | string[] | undefined>) {
  const dashboardToken = readDashboardToken();

  if (!dashboardToken && process.env.NODE_ENV === "production") {
    notFound();
  }

  if (dashboardToken && readFirst(searchParams.token) !== dashboardToken) {
    notFound();
  }
}

function isPrismaSchemaMissing(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }

  return error instanceof Prisma.PrismaClientValidationError;
}

function isPrismaUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1008", "P2024"].includes(error.code);
  }

  return false;
}

function toGroupCounts<T extends { _count: { _all: number }; _max?: { createdAt: Date | null } }>(
  groups: T[],
  key: keyof T,
  fallback: string,
): GroupCount[] {
  return groups
    .map((group) => ({
      key: String(group[key] ?? fallback),
      count: group._count._all,
      lastSeenAt: group._max?.createdAt,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function toRawGroupCounts(groups: RawGroupCount[]): GroupCount[] {
  return groups.map((group) => ({
    key: group.key ?? "unknown",
    count: typeof group.count === "bigint" ? Number(group.count) : group.count,
    lastSeenAt: group.lastSeenAt,
  }));
}

async function loadTelemetryData(limit: number): Promise<TelemetryData> {
  if (!process.env.DATABASE_URL) {
    return {
      status: "not-configured",
      message: "DATABASE_URL is not configured for this deployment.",
    };
  }

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const totalEvents = await prisma.docsTelemetryEvent.count();
    const eventsLast24h = await prisma.docsTelemetryEvent.count({
      where: { createdAt: { gte: last24h } },
    });
    const distinctIdentities = await prisma.docsTelemetryEvent.findMany({
      where: { identityHash: { not: null } },
      distinct: ["identityHash"],
      select: { identityHash: true },
    });
    const distinctSites = await prisma.docsTelemetryEvent.findMany({
      where: { siteOrigin: { not: null } },
      distinct: ["siteOrigin"],
      select: { siteOrigin: true },
    });
    const recentEvents = await prisma.docsTelemetryEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        eventType: true,
        identityHash: true,
        packageName: true,
        packageVersion: true,
        framework: true,
        runtimeName: true,
        siteOrigin: true,
        deploymentProvider: true,
        deploymentEnvironment: true,
        deploymentId: true,
        properties: true,
        createdAt: true,
      },
    });
    const eventTypeGroups = await prisma.docsTelemetryEvent.groupBy({
      by: ["eventType"],
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const frameworkGroups = await prisma.docsTelemetryEvent.groupBy({
      by: ["framework"],
      where: { framework: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const packageVersionGroups = await prisma.docsTelemetryEvent.groupBy({
      by: ["packageVersion"],
      where: { packageVersion: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const deploymentProviderGroups = await prisma.docsTelemetryEvent.groupBy({
      by: ["deploymentProvider"],
      where: { deploymentProvider: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const topSiteGroups = await prisma.docsTelemetryEvent.groupBy({
      by: ["siteOrigin"],
      where: { siteOrigin: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const topIdentityGroups = await prisma.docsTelemetryEvent.groupBy({
      by: ["identityHash"],
      where: { identityHash: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const featureFlagGroups = await prisma.$queryRaw<RawGroupCount[]>`
      SELECT
        feature.key AS key,
        COUNT(*)::int AS count,
        MAX("DocsTelemetryEvent"."createdAt") AS "lastSeenAt"
      FROM "DocsTelemetryEvent"
      CROSS JOIN LATERAL jsonb_each(
        CASE
          WHEN jsonb_typeof("DocsTelemetryEvent"."features"::jsonb) = 'object'
            THEN "DocsTelemetryEvent"."features"::jsonb
          ELSE '{}'::jsonb
        END
      ) AS feature(key, value)
      WHERE feature.value = 'true'::jsonb
      GROUP BY feature.key
      ORDER BY count DESC, feature.key ASC
      LIMIT 24
    `;
    const agentSurfaceGroups = await prisma.$queryRaw<RawGroupCount[]>`
      WITH derived AS (
        SELECT
          CASE
            WHEN NULLIF("properties"::jsonb ->> 'tool', '') IS NOT NULL
              THEN COALESCE(NULLIF("properties"::jsonb ->> 'surface', ''), 'mcp')
                || ':' || NULLIF("properties"::jsonb ->> 'tool', '')
            ELSE COALESCE(
              NULLIF("properties"::jsonb ->> 'surface', ''),
              CASE WHEN "eventType" = 'mcp_request' THEN 'mcp' END
            )
          END AS key,
          "createdAt"
        FROM "DocsTelemetryEvent"
      )
      SELECT
        key,
        COUNT(*)::int AS count,
        MAX("createdAt") AS "lastSeenAt"
      FROM derived
      WHERE key IS NOT NULL
      GROUP BY key
      ORDER BY count DESC, key ASC
      LIMIT 24
    `;

    return {
      status: "ready",
      totalEvents,
      eventsLast24h,
      uniqueIdentities: distinctIdentities.length,
      uniqueSites: distinctSites.length,
      recentEvents,
      eventTypes: toGroupCounts(eventTypeGroups, "eventType", "unknown"),
      frameworks: toGroupCounts(frameworkGroups, "framework", "unknown"),
      packageVersions: toGroupCounts(packageVersionGroups, "packageVersion", "unknown"),
      deploymentProviders: toGroupCounts(deploymentProviderGroups, "deploymentProvider", "unknown"),
      topSites: toGroupCounts(topSiteGroups, "siteOrigin", "unknown").slice(0, 24),
      topIdentities: toGroupCounts(topIdentityGroups, "identityHash", "unknown").slice(0, 24),
      featureFlags: toRawGroupCounts(featureFlagGroups),
      agentSurfaces: toRawGroupCounts(agentSurfaceGroups),
    };
  } catch (error) {
    if (isPrismaSchemaMissing(error)) {
      return {
        status: "schema-missing",
        message: "Telemetry schema is not synced with Prisma yet.",
      };
    }

    if (isPrismaUnavailable(error)) {
      return {
        status: "unavailable",
        message: "Telemetry database is currently unreachable.",
      };
    }

    throw error;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

function shortHash(value: string | null): string {
  if (!value) return "-";
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function shortText(value: string | null | undefined, max = 72): string {
  if (!value) return "-";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-black">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 dark:text-white/40">
          {label}
        </p>
        <Icon className="size-4 text-neutral-500 dark:text-white/45" strokeWidth={1.8} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function GroupTable({
  title,
  groups,
  keyLabel = "Name",
  className = "",
  truncateKey = false,
}: {
  title: string;
  groups: GroupCount[];
  keyLabel?: string;
  className?: string;
  truncateKey?: boolean;
}) {
  return (
    <section
      className={`border border-neutral-200 bg-white dark:border-white/10 dark:bg-black ${className}`}
    >
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] table-fixed text-left text-sm">
          <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500 dark:bg-white/[0.03] dark:text-white/40">
            <tr>
              <th className="px-4 py-2 font-medium">{keyLabel}</th>
              <th className="w-24 px-4 py-2 text-right font-medium">Events</th>
              <th className="w-40 px-4 py-2 text-right font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
            {groups.length > 0 ? (
              groups.map((group) => (
                <tr key={group.key}>
                  <td
                    className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-white/70"
                    title={group.key}
                  >
                    {truncateKey ? (
                      <span className="block truncate">{group.key}</span>
                    ) : (
                      shortText(group.key, 84)
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-neutral-950 dark:text-white">
                    {formatNumber(group.count)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-neutral-500 dark:text-white/45">
                    {formatDate(group.lastSeenAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-4 text-sm text-neutral-500 dark:text-white/45" colSpan={3}>
                  No rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PageRails() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 hidden lg:block">
      <div className="absolute inset-y-0 left-0 w-3 border-r border-neutral-200 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.45),rgba(0,0,0,0.45)_1px,transparent_1px,transparent_5px)] opacity-[0.08] dark:border-white/[8%] dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_1px,transparent_1px,transparent_5px)] dark:opacity-[0.1]" />
      <div className="absolute inset-y-0 right-0 w-3 border-l border-neutral-200 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.45),rgba(0,0,0,0.45)_1px,transparent_1px,transparent_5px)] opacity-[0.08] dark:border-white/[8%] dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_1px,transparent_1px,transparent_5px)] dark:opacity-[0.1]" />
      <div className="absolute inset-y-0 left-3 w-px bg-neutral-200 dark:bg-white/[8%]" />
      <div className="absolute inset-y-0 right-3 w-px bg-neutral-200 dark:bg-white/[8%]" />
    </div>
  );
}

function StatusPanel({
  data,
}: {
  data: Extract<TelemetryData, { status: Exclude<TelemetryData["status"], "ready"> }>;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-neutral-50 text-neutral-950 dark:bg-black dark:text-white">
      <PageRails />
      <div className="relative z-10 flex min-h-dvh items-center px-4 py-16 sm:px-6 lg:px-8 xl:px-10">
        <div className="mx-auto w-full max-w-3xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-black">
          <div className="flex items-center gap-3">
            <AlertTriangle
              className="size-5 text-neutral-500 dark:text-white/50"
              strokeWidth={1.8}
            />
            <h1 className="text-lg font-semibold text-neutral-950 dark:text-white">
              Usage metrics
            </h1>
          </div>
          <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-white/60">
            {data.message}
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function TelemetryPage({ searchParams }: TelemetryPageProps) {
  const params = (await searchParams) ?? {};
  assertDashboardAccess(params);

  const limit = readLimit(params.limit);
  const data = await loadTelemetryData(limit);

  if (data.status !== "ready") {
    return <StatusPanel data={data} />;
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-neutral-50 text-neutral-950 dark:bg-black dark:text-white">
      <PageRails />
      <div className="relative z-10 w-full px-3 py-4 sm:px-5 lg:px-8 xl:px-10">
        <header className="border border-neutral-200 bg-white p-5 dark:border-white/10 dark:bg-black">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-white/45">
                <Activity className="size-3.5" strokeWidth={1.8} />
                Usage
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Usage metrics
              </h1>
            </div>
            <div className="font-mono text-xs text-neutral-500 dark:text-white/45">
              Last refreshed {formatDate(new Date())} UTC
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total events" value={formatNumber(data.totalEvents)} icon={Database} />
          <StatCard label="Last 24h" value={formatNumber(data.eventsLast24h)} icon={Activity} />
          <StatCard
            label="Unique identities"
            value={formatNumber(data.uniqueIdentities)}
            icon={Fingerprint}
          />
          <StatCard label="Unique sites" value={formatNumber(data.uniqueSites)} icon={Globe2} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          <GroupTable title="Event types" groups={data.eventTypes} />
          <GroupTable title="Frameworks" groups={data.frameworks} />
          <GroupTable title="Package versions" groups={data.packageVersions} />
          <GroupTable title="Deployment providers" groups={data.deploymentProviders} />
          <GroupTable title="Agent surfaces" groups={data.agentSurfaces} />
          <GroupTable title="Feature flags" groups={data.featureFlags} />
          <GroupTable
            title="Top sites"
            groups={data.topSites}
            keyLabel="Site origin"
            className="xl:col-span-2 2xl:col-span-3"
          />
          <GroupTable
            title="Top identity hashes"
            groups={data.topIdentities}
            keyLabel="Identity hash"
            className="xl:col-span-2 2xl:col-span-3"
            truncateKey
          />
        </section>

        <section className="mt-4 border border-neutral-200 bg-white dark:border-white/10 dark:bg-black">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-semibold">Recent events</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500 dark:bg-white/[0.03] dark:text-white/40">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Site</th>
                  <th className="px-4 py-2 font-medium">Identity</th>
                  <th className="px-4 py-2 font-medium">Framework</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Deployment</th>
                  <th className="px-4 py-2 font-medium">Properties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
                {data.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-500 dark:text-white/45">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-950 dark:text-white">
                      {event.eventType}
                    </td>
                    <td className="max-w-[220px] px-4 py-2 font-mono text-xs text-neutral-700 dark:text-white/70">
                      {shortText(event.siteOrigin, 80)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-500 dark:text-white/45">
                      {shortHash(event.identityHash)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{event.framework ?? "-"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{event.packageVersion ?? "-"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-white/70">
                      {shortText(
                        [event.deploymentProvider, event.deploymentEnvironment]
                          .filter(Boolean)
                          .join(" / ") || event.deploymentId,
                        64,
                      )}
                    </td>
                    <td className="max-w-[220px] px-4 py-2 font-mono text-xs text-neutral-500 dark:text-white/45">
                      {shortText(JSON.stringify(event.properties ?? {}), 96)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

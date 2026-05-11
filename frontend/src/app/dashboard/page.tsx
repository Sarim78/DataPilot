"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PipelineCard,
  type Pipeline,
  type PipelineHealth,
  type PipelineRun,
} from "@/components/PipelineCard";
import { SidebarLayout } from "@/components/StatusBadge";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ??
  "http://localhost:8000";

function isWithinLast24h(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - 24 * 60 * 60 * 1000;
}

function runAnchorTime(r: PipelineRun): string | null {
  return r.finished_at ?? r.started_at;
}

function aggregate24h(runsByPipeline: PipelineRun[][]): {
  failures24h: number;
  successRate: number | null;
} {
  const flat = runsByPipeline.flat();
  const inWindow = flat.filter((r) => isWithinLast24h(runAnchorTime(r)));
  const failures = inWindow.filter((r) => r.status === "failed").length;
  const terminal = inWindow.filter(
    (r) => r.status === "success" || r.status === "failed",
  );
  const successes = terminal.filter((r) => r.status === "success").length;
  const denom = terminal.length;
  const successRate =
    denom === 0 ? null : Math.round((successes / denom) * 1000) / 10;
  return { failures24h: failures, successRate };
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export default function DashboardPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [healthById, setHealthById] = useState<Record<string, PipelineHealth>>(
    {},
  );
  const [runsByPipeline, setRunsByPipeline] = useState<PipelineRun[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setError(null);
    try {
      const listRes = await fetch(`${API_BASE}/api/pipelines`);
      if (!listRes.ok) {
        throw new Error(await readErrorMessage(listRes));
      }
      const list = (await listRes.json()) as Pipeline[];
      setPipelines(list);

      if (list.length === 0) {
        setHealthById({});
        setRunsByPipeline([]);
        return;
      }

      const healthResults = await Promise.all(
        list.map(async (p) => {
          const res = await fetch(`${API_BASE}/api/pipelines/${p.id}/health`);
          if (!res.ok) {
            throw new Error(
              `Health for ${p.name}: ${await readErrorMessage(res)}`,
            );
          }
          return (await res.json()) as PipelineHealth;
        }),
      );

      const nextHealth: Record<string, PipelineHealth> = {};
      for (const h of healthResults) {
        nextHealth[h.pipeline_id] = h;
      }
      setHealthById(nextHealth);

      const runsResults = await Promise.all(
        list.map(async (p) => {
          const res = await fetch(
            `${API_BASE}/api/pipelines/${p.id}/runs?limit=80`,
          );
          if (!res.ok) {
            throw new Error(
              `Runs for ${p.name}: ${await readErrorMessage(res)}`,
            );
          }
          return (await res.json()) as PipelineRun[];
        }),
      );
      setRunsByPipeline(runsResults);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { failures24h, successRate } = useMemo(
    () => aggregate24h(runsByPipeline),
    [runsByPipeline],
  );

  const bump = () => setRefreshKey((k) => k + 1);

  const formatRefreshTime = (d: Date) =>
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Pipelines
            </h1>
            <p className="mt-1 text-sm text-[#a1a1aa]">
              Live pipeline health
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#52525b]">
              Updated {formatRefreshTime(lastRefresh)}
            </span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                bump();
              }}
              className="rounded-[6px] border border-[#27272a] px-3 py-1.5 text-xs font-medium text-[#a1a1aa] transition-colors duration-150 hover:border-[#3f3f46] hover:text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        <section className="mb-8 grid gap-px overflow-hidden rounded-[8px] border border-[#27272a] bg-[#27272a] sm:grid-cols-3">
          <div className="bg-[#111111] p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#52525b]">
              Total Pipelines
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {loading && pipelines.length === 0 ? "\u2014" : pipelines.length}
            </p>
          </div>
          <div className="bg-[#111111] p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#52525b]">
              Failures (24h)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#ef4444]">
              {loading && pipelines.length === 0 ? "\u2014" : failures24h}
            </p>
          </div>
          <div className="bg-[#111111] p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#52525b]">
              Success Rate (24h)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#22c55e]">
              {loading && pipelines.length === 0
                ? "\u2014"
                : successRate === null
                  ? "N/A"
                  : `${successRate}%`}
            </p>
          </div>
        </section>

        {error && (
          <div
            className="mb-6 rounded-[6px] border border-[#ef4444]/25 bg-[#ef4444]/[0.07] px-4 py-3 text-sm text-[#ef4444]"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading && pipelines.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[#52525b]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#27272a] border-t-[#3b82f6]" />
            Loading pipelines...
          </div>
        ) : !loading && pipelines.length === 0 ? (
          <div className="rounded-[8px] border border-[#27272a] bg-[#111111] px-6 py-12 text-center">
            <p className="text-sm text-[#a1a1aa]">
              No pipelines found. Run seed.py to populate.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pipelines.map((p) => {
              const h = healthById[p.id];
              if (!h) return null;
              return (
                <PipelineCard
                  key={p.id}
                  pipeline={p}
                  health={h}
                  apiBase={API_BASE}
                  onReportsChanged={bump}
                />
              );
            })}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PipelineCard, type Pipeline, type PipelineHealth, type PipelineRun } from "@/components/PipelineCard";

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
  const successRate = denom === 0 ? null : Math.round((successes / denom) * 1000) / 10;
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

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Pipelines
          </h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Live view of run health, refreshed every 30 seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            bump();
          }}
          className="self-start rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-white/[0.14] hover:bg-white/[0.06]"
        >
          Refresh now
        </button>
      </div>

      <section className="mb-10 grid gap-3 rounded-xl border border-white/[0.06] bg-surface-raised/50 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Total pipelines
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {loading && pipelines.length === 0 ? "—" : pipelines.length}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Failures (24h)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-400">
            {loading && pipelines.length === 0 ? "—" : failures24h}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Success rate (24h)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">
            {loading && pipelines.length === 0
              ? "—"
              : successRate === null
                ? "N/A"
                : `${successRate}%`}
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            Among completed runs in the last 24 hours.
          </p>
        </div>
      </section>

      {error ? (
        <div
          className="mb-8 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-100/90"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && pipelines.length === 0 ? (
        <p className="text-sm text-neutral-500">Loading pipelines…</p>
      ) : !loading && pipelines.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No pipelines yet. Seed the database or create one via the API.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {pipelines.map((p) => {
            const h = healthById[p.id];
            if (!h) return null;
            return (
              <li key={p.id}>
                <PipelineCard
                  pipeline={p}
                  health={h}
                  apiBase={API_BASE}
                  onReportsChanged={bump}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

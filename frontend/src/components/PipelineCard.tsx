"use client";

import { useCallback, useState } from "react";
import {
  StatusBadge,
  mapBackendRunStatus,
  type DashboardRunStatus,
} from "./StatusBadge";

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  schedule_cron: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  rows_processed: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface PipelineHealth {
  pipeline_id: string;
  pipeline_name: string;
  health: string;
  last_run: PipelineRun | null;
  recent_failure_count: number;
  notes: string | null;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function displayStatusFromHealth(health: PipelineHealth): DashboardRunStatus {
  const run = health.last_run;
  if (!run) return "skipped";
  return mapBackendRunStatus(run.status);
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((e) => (typeof e === "object" && e && "msg" in e ? String((e as { msg: string }).msg) : String(e)))
        .join("; ");
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export function PipelineCard({
  pipeline,
  health,
  apiBase,
  onReportsChanged,
}: {
  pipeline: Pipeline;
  health: PipelineHealth;
  apiBase: string;
  onReportsChanged?: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<PipelineRun[] | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const dashStatus = displayStatusFromHealth(health);
  const lastRun = health.last_run;
  const lastAt =
    lastRun?.finished_at ?? lastRun?.started_at ?? null;
  const rows = lastRun?.rows_processed;
  const isFailed = dashStatus === "failed";

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsError(null);
    try {
      const res = await fetch(
        `${apiBase}/api/pipelines/${pipeline.id}/runs?limit=50`,
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const data = (await res.json()) as PipelineRun[];
      setRuns(data);
    } catch (e) {
      setRunsError(e instanceof Error ? e.message : "Could not load runs");
    } finally {
      setRunsLoading(false);
    }
  }, [apiBase, pipeline.id]);

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && runs === null) void loadRuns();
  };

  const generateReport = async () => {
    setReportLoading(true);
    setReportFeedback(null);
    try {
      const res = await fetch(
        `${apiBase}/api/reports/generate-from-failures/${pipeline.id}`,
        { method: "POST" },
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const created = (await res.json()) as unknown[];
      const n = Array.isArray(created) ? created.length : 0;
      setReportFeedback(
        n === 0
          ? "No new reports (failures may already be covered)."
          : `Generated ${n} incident report${n === 1 ? "" : "s"}.`,
      );
      onReportsChanged?.();
    } catch (e) {
      setReportFeedback(
        e instanceof Error ? e.message : "Report request failed",
      );
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <article className="group rounded-xl border border-white/[0.06] bg-surface-raised/80 transition-all duration-200 hover:border-white/[0.1]">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-tight text-white">
              {pipeline.name}
            </h3>
            {pipeline.owner ? (
              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {pipeline.owner}
              </p>
            ) : null}
          </div>
          <StatusBadge status={dashStatus} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-neutral-500">Last run</dt>
            <dd className="mt-0.5 font-medium text-neutral-200">
              {formatDateTime(lastAt)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Records</dt>
            <dd className="mt-0.5 font-medium text-neutral-200">
              {rows !== null && rows !== undefined
                ? rows.toLocaleString()
                : "—"}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-neutral-500">Health</dt>
            <dd className="mt-0.5 font-medium capitalize text-neutral-300">
              {health.health}
            </dd>
          </div>
        </dl>

        {isFailed && lastRun?.error_message ? (
          <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-rose-400/90">
              Error
            </p>
            <p className="mt-1 text-xs leading-relaxed text-rose-100/80">
              {lastRun.error_message}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleHistory}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-white/[0.14] hover:bg-white/[0.06]"
          >
            {historyOpen ? "Hide run history" : "View run history"}
          </button>
          <button
            type="button"
            disabled={!isFailed || reportLoading}
            onClick={() => void generateReport()}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-transparent disabled:text-neutral-600"
          >
            {reportLoading ? "Working…" : "Incident report"}
          </button>
        </div>
        {!isFailed ? (
          <p className="mt-2 text-[11px] text-neutral-600">
            Incident reports are available when the latest run has failed.
          </p>
        ) : null}
        {reportFeedback ? (
          <p className="mt-2 text-xs text-neutral-400">{reportFeedback}</p>
        ) : null}
      </div>

      {historyOpen ? (
        <div className="border-t border-white/[0.06] bg-[#0d0d0d] px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Run history
          </p>
          {runsLoading ? (
            <p className="mt-3 text-sm text-neutral-500">Loading runs…</p>
          ) : runsError ? (
            <p className="mt-3 text-sm text-rose-400">{runsError}</p>
          ) : runs && runs.length > 0 ? (
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={mapBackendRunStatus(r.status)} />
                    <span className="text-neutral-500">
                      {formatDateTime(r.started_at ?? r.finished_at)}
                    </span>
                  </div>
                  <span className="text-neutral-400">
                    {r.rows_processed !== null && r.rows_processed !== undefined
                      ? `${r.rows_processed.toLocaleString()} rows`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No runs recorded.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

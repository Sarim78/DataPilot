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
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
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
        .map((e) =>
          typeof e === "object" && e && "msg" in e
            ? String((e as { msg: string }).msg)
            : String(e),
        )
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
  const lastAt = lastRun?.finished_at ?? lastRun?.started_at ?? null;
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
    <article className="rounded-[8px] border border-[#27272a] bg-[#111111] transition-colors duration-150 hover:border-[#3f3f46]">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-white">
              {pipeline.name}
            </h3>
            {pipeline.owner && (
              <p className="mt-0.5 truncate text-xs text-[#52525b]">
                {pipeline.owner}
              </p>
            )}
          </div>
          <StatusBadge status={dashStatus} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[#52525b]">Last run</dt>
            <dd className="mt-0.5 font-medium text-[#a1a1aa]">
              {formatDateTime(lastAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[#52525b]">Records</dt>
            <dd className="mt-0.5 font-medium text-[#a1a1aa]">
              {rows !== null && rows !== undefined
                ? rows.toLocaleString()
                : "\u2014"}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-[#52525b]">Health</dt>
            <dd className="mt-0.5 font-medium capitalize text-[#a1a1aa]">
              {health.health}
            </dd>
          </div>
        </dl>

        {isFailed && lastRun?.error_message && (
          <div className="mt-4 rounded-[6px] border border-[#ef4444]/20 bg-[#ef4444]/[0.06] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#ef4444]/80">
              Error
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#ef4444]/70">
              {lastRun.error_message}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleHistory}
            className="rounded-[6px] border border-[#27272a] px-3 py-1.5 text-xs font-medium text-[#a1a1aa] transition-colors duration-150 hover:border-[#3f3f46] hover:text-white"
          >
            {historyOpen ? "Hide Runs" : "View Runs"}
          </button>
          {isFailed && (
            <button
              type="button"
              disabled={reportLoading}
              onClick={() => void generateReport()}
              className="rounded-[6px] border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3 py-1.5 text-xs font-medium text-[#3b82f6] transition-colors duration-150 hover:bg-[#3b82f6]/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reportLoading ? "Working..." : "Generate Report"}
            </button>
          )}
        </div>
        {reportFeedback && (
          <p className="mt-2 text-xs text-[#a1a1aa]">{reportFeedback}</p>
        )}
      </div>

      {historyOpen && (
        <div className="border-t border-[#27272a] bg-[#0a0a0a] px-5 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#52525b]">
            Run history
          </p>
          {runsLoading ? (
            <p className="mt-3 text-sm text-[#52525b]">Loading runs...</p>
          ) : runsError ? (
            <p className="mt-3 text-sm text-[#ef4444]">{runsError}</p>
          ) : runs && runs.length > 0 ? (
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#27272a] bg-[#111111] px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={mapBackendRunStatus(r.status)} />
                    <span className="text-[#52525b]">
                      {formatDateTime(r.started_at ?? r.finished_at)}
                    </span>
                  </div>
                  <span className="text-[#a1a1aa]">
                    {r.rows_processed !== null && r.rows_processed !== undefined
                      ? `${r.rows_processed.toLocaleString()} rows`
                      : "\u2014"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#52525b]">No runs recorded.</p>
          )}
        </div>
      )}
    </article>
  );
}

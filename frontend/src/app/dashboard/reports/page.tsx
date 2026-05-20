"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SidebarLayout } from "@/components/StatusBadge";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ReportSeverity = "low" | "medium" | "high" | "critical";

interface IncidentReport {
  id: string;
  title: string;
  summary: string;
  severity: ReportSeverity;
  pipeline_id: string;
  run_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface Pipeline {
  id: string;
  name: string;
}

const SEVERITY_STYLES: Record<
  ReportSeverity,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "border-red-500/30 bg-red-500/10 text-[#ef4444]",
  },
  high: {
    label: "High",
    className: "border-orange-500/35 bg-orange-500/10 text-[#f97316]",
  },
  medium: {
    label: "Medium",
    className: "border-amber-500/35 bg-amber-500/10 text-[#eab308]",
  },
  low: {
    label: "Low",
    className: "border-[#27272a] bg-white/[0.04] text-[#a1a1aa]",
  },
};

function SeverityBadge({ severity }: { severity: ReportSeverity }) {
  const cfg = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium;
  return (
    <span
      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium capitalize ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function pipelineNameFromTitle(title: string): string | null {
  const match = /^\[([^\]]+)\]/.exec(title);
  return match?.[1] ?? null;
}

function lineFromSummary(summary: string, prefix: string): string | null {
  const line = summary
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!line) return null;
  const idx = line.indexOf(":");
  if (idx === -1) return line;
  return line.slice(idx + 1).trim() || null;
}

function detailString(
  details: Record<string, unknown>,
  key: string,
): string | null {
  const v = details[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pipelineNameForReport(
  report: IncidentReport,
  namesById: Record<string, string>,
): string {
  return (
    namesById[report.pipeline_id] ??
    pipelineNameFromTitle(report.title) ??
    "Unknown pipeline"
  );
}

function rootCauseForReport(report: IncidentReport): string {
  return (
    detailString(report.details, "root_cause") ??
    lineFromSummary(report.summary, "Error:") ??
    lineFromSummary(report.summary, "Root cause:") ??
    "No root cause recorded."
  );
}

function suggestedFixForReport(report: IncidentReport): string {
  return (
    detailString(report.details, "suggested_fix") ??
    detailString(report.details, "suggestedFix") ??
    lineFromSummary(report.summary, "Suggested fix:") ??
    "No suggested fix recorded."
  );
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

export default function ReportsPage() {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [pipelineNames, setPipelineNames] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [reportsRes, pipelinesRes] = await Promise.all([
        fetch(`${API_URL}/api/reports`),
        fetch(`${API_URL}/api/pipelines`),
      ]);

      if (!reportsRes.ok) {
        throw new Error(await readErrorMessage(reportsRes));
      }

      const list = (await reportsRes.json()) as IncidentReport[];
      setReports(list);

      if (pipelinesRes.ok) {
        const pipelines = (await pipelinesRes.json()) as Pipeline[];
        const names: Record<string, string> = {};
        for (const p of pipelines) {
          names[p.id] = p.name;
        }
        setPipelineNames(names);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedReports = useMemo(
    () =>
      [...reports].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [reports],
  );

  return (
    <SidebarLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Incident Reports
          </h1>
          <p className="mt-1 text-sm text-[#a1a1aa]">
            Auto-generated failure analysis and remediation hints
          </p>
        </div>

        {error && (
          <div
            className="mb-6 rounded-[6px] border border-[#ef4444]/25 bg-[#ef4444]/[0.07] px-4 py-3 text-sm text-[#ef4444]"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#52525b]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#27272a] border-t-[#3b82f6]" />
            Loading reports...
          </div>
        ) : sortedReports.length === 0 ? (
          <div className="rounded-[8px] border border-[#27272a] bg-[#111111] px-6 py-12 text-center">
            <p className="text-sm text-[#a1a1aa]">No incident reports yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedReports.map((report) => (
              <article
                key={report.id}
                className="rounded-[8px] border border-[#27272a] bg-[#111111] p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-white">
                      {pipelineNameForReport(report, pipelineNames)}
                    </h2>
                    <p className="mt-0.5 text-xs text-[#52525b]">
                      {report.title}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <SeverityBadge severity={report.severity} />
                    <time
                      className="text-xs text-[#52525b]"
                      dateTime={report.created_at}
                    >
                      {formatCreatedAt(report.created_at)}
                    </time>
                  </div>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-[#52525b]">
                      Summary
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#a1a1aa]">
                      {report.summary}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-[#52525b]">
                      Root cause
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#d4d4d8]">
                      {rootCauseForReport(report)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-[#52525b]">
                      Suggested fix
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#d4d4d8]">
                      {suggestedFixForReport(report)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

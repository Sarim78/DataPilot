"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardRunStatus =
  | "success"
  | "failed"
  | "running"
  | "skipped"
  | "pending";

const styles: Record<
  DashboardRunStatus,
  { label: string; className: string }
> = {
  success: {
    label: "Success",
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  },
  failed: {
    label: "Failed",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  },
  running: {
    label: "Running",
    className: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  },
  skipped: {
    label: "Skipped",
    className: "border-white/[0.08] bg-white/[0.04] text-neutral-500",
  },
  pending: {
    label: "Pending",
    className: "border-white/[0.08] bg-white/[0.04] text-neutral-400",
  },
};

export function mapBackendRunStatus(
  status: string | undefined,
): DashboardRunStatus {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "failed";
    case "running":
      return "running";
    case "pending":
      return "pending";
    case "cancelled":
      return "skipped";
    default:
      return "skipped";
  }
}

export function StatusBadge({ status }: { status: DashboardRunStatus }) {
  const cfg = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide transition-colors ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

const navLink =
  "rounded-md px-3 py-1.5 text-sm font-medium text-neutral-400 transition-colors hover:text-white";
const navActive =
  "bg-white/[0.06] text-white shadow-ring";

export function AppTopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-white transition-opacity hover:opacity-90"
        >
          Datapilot
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link
            href="/"
            className={`${navLink} ${pathname === "/" ? navActive : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/agent"
            className={`${navLink} ${pathname === "/agent" ? navActive : ""}`}
          >
            Agent
          </Link>
        </nav>
      </div>
    </header>
  );
}

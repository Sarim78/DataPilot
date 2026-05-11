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
      "border-emerald-500/25 bg-emerald-500/10 text-[#22c55e]",
  },
  failed: {
    label: "Failed",
    className: "border-red-500/30 bg-red-500/10 text-[#ef4444]",
  },
  running: {
    label: "Running",
    className: "border-amber-500/35 bg-amber-500/10 text-[#f59e0b]",
  },
  skipped: {
    label: "Skipped",
    className: "border-[#27272a] bg-white/[0.04] text-[#52525b]",
  },
  pending: {
    label: "Pending",
    className: "border-[#27272a] bg-white/[0.04] text-[#a1a1aa]",
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
      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Pipelines",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 4h12M2 8h12M2 12h12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 2h5.5L13 5.5V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 2v4h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/agent",
    label: "Agent",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 10a2 2 0 0 1-2 2H5l-3 3V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-[#27272a] bg-[#1a1a1a]">
        <div className="flex h-14 items-center px-5">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-white transition-opacity duration-150 hover:opacity-80"
          >
            Datapilot
          </Link>
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/dashboard" && pathname.startsWith("/dashboard"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-[6px] px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-white/[0.06] text-white"
                    : "text-[#a1a1aa] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#3b82f6]" />
                )}
                <span className="text-current">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="ml-56 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

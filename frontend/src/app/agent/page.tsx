"use client";

import { AgentChat } from "@/components/AgentChat";
import { SidebarLayout } from "@/components/StatusBadge";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ??
  "http://localhost:8000";

export default function AgentPage() {
  return (
    <SidebarLayout>
      <div className="flex h-screen flex-col">
        <div className="border-b border-[#27272a] px-6 py-4">
          <h1 className="text-sm font-semibold text-white">Agent</h1>
          <p className="mt-0.5 text-xs text-[#52525b]">
            Natural language interface for your pipelines and incident history.
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <AgentChat apiBase={API_BASE} />
        </div>
      </div>
    </SidebarLayout>
  );
}

import { AgentChat } from "@/components/AgentChat";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ??
  "http://localhost:8000";

export default function AgentPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Datapilot agent
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Natural language over your pipelines and incident history.
        </p>
      </div>
      <AgentChat apiBase={API_BASE} />
    </div>
  );
}

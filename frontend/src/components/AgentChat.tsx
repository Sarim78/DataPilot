"use client";

import { useCallback, useRef, useState } from "react";

type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

const STARTERS = [
  "List all pipelines",
  "Show me recent failures",
  "Generate an incident report for CreditStream",
  "What failed last night?",
];

function extractReply(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  const keys = [
    "reply",
    "response",
    "message",
    "content",
    "answer",
    "text",
    "output",
  ] as const;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function AgentChat({ apiBase }: { apiBase: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);
      setError(null);
      requestAnimationFrame(scrollToBottom);

      try {
        const res = await fetch(`${apiBase}/api/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const raw = await res.text();
        let parsed: unknown = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }

        let assistantText: string;
        if (!res.ok) {
          assistantText =
            (parsed ? extractReply(parsed) : null) ??
            (raw || (await readErrorMessage(res)));
        } else {
          assistantText =
            extractReply(parsed) ??
            (typeof raw === "string" && raw.trim()
              ? raw
              : "Received an empty response from the agent.");
        }

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
        };
        setMessages((m) => [...m, assistantMsg]);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Network error while contacting agent.",
        );
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Could not reach the agent endpoint. Confirm the API is running and exposes POST /api/agent.",
          createdAt: new Date().toISOString(),
        };
        setMessages((m) => [...m, assistantMsg]);
      } finally {
        setLoading(false);
        setTimeout(scrollToBottom, 50);
      }
    },
    [apiBase, loading, scrollToBottom],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const showStarters = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[420px] flex-col rounded-xl border border-white/[0.06] bg-surface-raised/60 shadow-ring">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Agent</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Ask about pipelines, failures, and incident reports.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {error ? (
          <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
            {error}
          </div>
        ) : null}

        {showStarters ? (
          <div className="mb-6">
            <p className="text-xs text-neutral-500">Suggested prompts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => void send(q)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-left text-xs text-neutral-300 transition-colors hover:border-accent/35 hover:bg-accent/10 hover:text-white disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ul className="space-y-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {m.role === "assistant" ? (
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-gradient-to-br from-accent/20 to-transparent text-[10px] font-bold text-accent"
                  aria-hidden
                >
                  DP
                </div>
              ) : (
                <div
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.06]"
                  aria-hidden
                />
              )}
              <div
                className={`max-w-[min(100%,36rem)] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-colors ${
                    m.role === "user"
                      ? "rounded-tr-md border border-accent/25 bg-accent/15 text-neutral-100"
                      : "rounded-tl-md border border-white/[0.06] bg-[#121212] text-neutral-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                <span className="px-1 text-[10px] text-neutral-600">
                  {formatTime(m.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {loading ? (
          <div className="mt-4 flex items-center gap-3 pl-11">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-gradient-to-br from-accent/20 to-transparent text-[10px] font-bold text-accent"
              aria-hidden
            >
              DP
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-white/[0.06] bg-[#121212] px-4 py-3">
              <span className="sr-only">Agent is typing</span>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-white/[0.06] p-4 sm:p-5"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Datapilot…"
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-4 py-2.5 text-sm text-white outline-none ring-accent/40 transition-[border,box-shadow] placeholder:text-neutral-600 focus:border-accent/40 focus:ring-2 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

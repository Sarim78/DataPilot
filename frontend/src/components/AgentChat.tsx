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
  "Generate a report for CreditStream",
  "What failed last night?",
] as const;

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
          e instanceof Error
            ? e.message
            : "Network error while contacting agent.",
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error && (
          <div className="mb-4 rounded-[6px] border border-[#f59e0b]/25 bg-[#f59e0b]/10 px-3 py-2 text-xs text-[#f59e0b]">
            {error}
          </div>
        )}

        {showStarters && (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-sm text-[#52525b]">Suggested prompts</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => void send(q)}
                  className="rounded-[6px] border border-[#27272a] bg-[#111111] px-4 py-2 text-sm text-[#a1a1aa] transition-colors duration-150 hover:border-[#3f3f46] hover:text-white disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {!showStarters && (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[#27272a] bg-[#1a1a1a] text-[10px] font-bold text-[#3b82f6]"
                    aria-hidden
                  >
                    D
                  </div>
                )}
                <div
                  className={`flex max-w-[min(100%,32rem)] flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-[8px] px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#3b82f6] text-white"
                        : "border border-[#27272a] bg-[#111111] text-[#a1a1aa]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                  <span className="px-1 text-[10px] text-[#52525b]">
                    {formatTime(m.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {loading && (
          <div className="mt-4 flex items-center gap-3">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[#27272a] bg-[#1a1a1a] text-[10px] font-bold text-[#3b82f6]"
              aria-hidden
            >
              D
            </div>
            <div className="flex items-center gap-1 rounded-[8px] border border-[#27272a] bg-[#111111] px-4 py-3">
              <span className="sr-only">Agent is typing</span>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#52525b] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#52525b] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#52525b]" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-[#27272a] bg-[#0a0a0a] px-6 py-4"
      >
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Datapilot..."
            disabled={loading}
            className="min-w-0 flex-1 rounded-[6px] border border-[#27272a] bg-[#111111] px-4 py-2.5 text-sm text-white outline-none transition-colors duration-150 placeholder:text-[#52525b] focus:border-[#3f3f46] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-[6px] bg-[#3b82f6] px-4 py-2.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

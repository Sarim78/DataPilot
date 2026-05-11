import Link from "next/link";

const features = [
  {
    title: "Real-time Monitoring",
    description:
      "Tracks every pipeline run and surfaces failures the moment they happen.",
  },
  {
    title: "AI-Powered Diagnosis",
    description:
      "Gemini reasons over your pipeline logs and explains exactly what went wrong.",
  },
  {
    title: "Instant Reports",
    description:
      "Auto-generates incident reports for every failure with root cause and suggested fix.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="fixed top-0 z-50 w-full border-b border-[#27272a] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-tight text-white">
            Datapilot
          </span>
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-[#a1a1aa] transition-colors duration-150 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/agent"
              className="text-sm text-[#a1a1aa] transition-colors duration-150 hover:text-white"
            >
              Agent
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-14">
        <section className="flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your pipelines.
            <br />
            Monitored by AI.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
            Datapilot watches your ETL pipelines, detects failures, and takes
            action - powered by Gemini and MongoDB.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-[6px] bg-[#3b82f6] px-5 py-2.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              Open Dashboard
            </Link>
            <Link
              href="/agent"
              className="rounded-[6px] border border-[#27272a] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:border-[#3f3f46] hover:bg-[#111111]"
            >
              Talk to Agent
            </Link>
          </div>
        </section>
      </main>

      <section className="border-t border-[#27272a] bg-[#0a0a0a] px-6 py-24">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-[8px] border border-[#27272a] bg-[#111111] p-6 transition-colors duration-150 hover:border-[#3f3f46]"
            >
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#27272a] px-6 py-8">
        <p className="text-center text-xs text-[#52525b]">
          Built for the Google Cloud Rapid Agent Hackathon &middot; MongoDB
          Track
        </p>
      </footer>
    </div>
  );
}

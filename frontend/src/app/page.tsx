import Link from "next/link";

const featureIcons: Record<string, React.ReactNode> = {
  "Real-time Monitoring": (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="1,12 5,12 7,6 10,16 13,8 15,12 19,12" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  "AI-Powered Diagnosis": (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 1l2.1 4.3 4.9.7-3.5 3.4.8 4.6L10 11.8 5.7 14l.8-4.6L3 6l4.9-.7L10 1z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="10" cy="16.5" r="1.5" stroke="#3b82f6" strokeWidth="1.2" fill="none" />
    </svg>
  ),
  "Instant Reports": (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1H4.5A1.5 1.5 0 003 2.5v15A1.5 1.5 0 004.5 19h11a1.5 1.5 0 001.5-1.5V6L12 1z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <polyline points="12,1 12,6 17,6" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="7" y1="10" x2="13" y2="10" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="7" y1="13" x2="11" y2="13" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
};

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
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      <header className="fixed top-0 z-50 w-full border-b border-[#27272a] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-sm font-semibold tracking-tight text-white">
            Datapilot
          </span>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link
              href="/dashboard"
              className="text-sm text-[#a1a1aa] transition-all duration-150 hover:text-white hover:underline hover:underline-offset-4"
            >
              Dashboard
            </Link>
            <Link
              href="/agent"
              className="text-sm text-[#a1a1aa] transition-all duration-150 hover:text-white hover:underline hover:underline-offset-4"
            >
              Agent
            </Link>
          </nav>
          <nav className="flex items-center gap-4 sm:hidden">
            <Link
              href="/dashboard"
              className="text-xs text-[#a1a1aa] transition-all duration-150 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/agent"
              className="text-xs text-[#a1a1aa] transition-all duration-150 hover:text-white"
            >
              Agent
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-10 sm:px-6 sm:pt-28 sm:pb-12">
        <section className="flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your pipelines.
            <br />
            Monitored by AI.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
            Datapilot watches your ETL pipelines, detects failures, and takes
            action - powered by Gemini and MongoDB.
          </p>
          <div className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4">
            <Link
              href="/dashboard"
              className="w-full rounded-[6px] bg-[#3b82f6] px-5 py-2.5 text-center text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 sm:w-auto"
            >
              Open Dashboard
            </Link>
            <Link
              href="/agent"
              className="w-full rounded-[6px] border border-[#27272a] px-5 py-2.5 text-center text-sm font-medium text-white transition-colors duration-150 hover:border-[#3f3f46] hover:bg-[#111111] sm:w-auto"
            >
              Talk to Agent
            </Link>
          </div>
        </section>
      </main>

      <section className="border-t border-[#27272a] bg-[#0a0a0a] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto grid max-w-5xl gap-4 sm:gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-[8px] border border-[#27272a] bg-[#111111] p-5 transition-colors duration-150 hover:border-[#3f3f46] sm:p-6"
            >
              <div className="mb-3">{featureIcons[f.title]}</div>
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-[#27272a] px-4 py-5 sm:px-6 sm:py-6">
        <p className="text-center text-xs text-[#52525b]">
          Built for the Google Cloud Rapid Agent Hackathon &middot; MongoDB
          Track
        </p>
      </footer>
    </div>
  );
}

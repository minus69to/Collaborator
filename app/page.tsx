export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-6 py-16 text-slate-100">
      {/* Hero */}
      <section className="relative mx-auto max-w-4xl text-center">
        {/* Decorative background glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-56 w-56 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-gradient-to-tr from-sky-500/40 via-indigo-500/25 to-emerald-400/30 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute left-2/3 top-6 -z-10 h-40 w-40 -translate-x-1/2 transform rounded-full bg-gradient-to-tr from-sky-400/30 to-blue-500/20 blur-3xl animate-pulse" />

        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Collaborator
        </h1>
        <p className="mx-auto mt-3 max-w-none text-slate-300 whitespace-normal sm:whitespace-nowrap">
          Meet, share your screen, record sessions, and get transcripts with AI summaries — all in one place.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-900/40 transition-all duration-150 ease-out hover:from-sky-400 hover:to-indigo-400 hover:shadow-md hover:ring-2 hover:ring-sky-400/40 hover:scale-[1.03] active:scale-95 active:translate-y-[1px]"
          >
            Get started
          </a>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-all duration-150 ease-out hover:bg-slate-950 hover:border-slate-500 hover:shadow-md hover:ring-2 hover:ring-slate-700/50 hover:scale-[1.03] active:scale-95 active:translate-y-[1px]"
          >
            Sign in
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-14 max-w-5xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Meetings */}
          <div className="flex h-full min-h-[180px] rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-sky-950/80 p-[1px] shadow-sm shadow-slate-950/40 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-900/50">
            <div className="flex w-full items-start gap-4 rounded-[0.9rem] bg-slate-950/70 px-5 py-5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-500/30">
                <svg className="h-5 w-5 text-sky-300" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h7a2 2 0 012 2v1l3-2v10l-3-2v1a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              </div>
              <div className="flex flex-1 flex-col justify-start">
                <h3 className="text-base font-semibold text-white leading-tight">Meetings</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Create or join meetings in seconds with reliable audio/video powered by 100ms.
                </p>
              </div>
            </div>
          </div>

          {/* Recordings */}
          <div className="flex h-full min-h-[180px] rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-rose-950/80 p-[1px] shadow-sm shadow-slate-950/40 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-900/50">
            <div className="flex w-full items-start gap-4 rounded-[0.9rem] bg-slate-950/70 px-5 py-5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/30">
                <svg className="h-5 w-5 text-rose-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex flex-1 flex-col justify-start">
                <h3 className="text-base font-semibold text-white leading-tight">Recordings</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Start/stop recordings, then download the correct MP4 directly from your dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Transcripts & AI Summaries */}
          <div className="flex h-full min-h-[180px] rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-emerald-950/80 p-[1px] shadow-sm shadow-slate-950/40 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/50">
            <div className="flex w-full items-start gap-4 rounded-[0.9rem] bg-slate-950/70 px-5 py-5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <svg className="h-5 w-5 text-emerald-300" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 3h12a1 1 0 011 1v10a2 2 0 01-2 2H6l-4 3V4a1 1 0 011-1z" />
                </svg>
              </div>
              <div className="flex flex-1 flex-col justify-start">
                <h3 className="text-base font-semibold leading-tight bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
                  Transcripts &amp; AI Summaries
                </h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Read transcripts and concise AI summaries in a clean modal — copy or review later.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    setIsLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const raw = error.message || "";
      const lower = raw.toLowerCase();
      let friendly = raw;

      if (lower.includes("invalid login credentials")) {
        friendly = "Incorrect email or password. Please try again.";
      } else if (lower.includes("email not confirmed")) {
        friendly = "Please confirm your email address from your inbox, then try signing in again.";
      } else if (!friendly) {
        friendly = "We couldn't sign you in. Please check your details and try again.";
      }

      setError(friendly);
    } else {
      setSuccess("Signed in! Redirecting to your meetings…");
      router.push("/meetings");
      router.refresh();
    }
    setIsLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-6 py-16 text-slate-100">
      <div className="relative w-full max-w-md">
        {/* soft background glow */}
        <div className="pointer-events-none absolute inset-x-6 -top-10 -z-10 h-40 rounded-3xl bg-gradient-to-r from-sky-500/25 via-indigo-500/20 to-emerald-400/20 blur-3xl" />
        <div className="w-full space-y-6 rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-slate-950 p-8 shadow-xl shadow-slate-900/70 backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-2xl hover:shadow-sky-900/60">
          <header className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Sign in</h1>
            <p className="text-sm text-slate-300">
              Access your{" "}
              <Link
                href="/"
                className="font-semibold text-sky-300 hover:text-sky-200 transition-colors"
              >
                Collaborator
              </Link>{" "}
              workspace.
            </p>
          </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-200">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 shadow-sm shadow-slate-950/40 transition-colors duration-150 ease-out hover:border-slate-500 hover:bg-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600/70"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 shadow-sm shadow-slate-950/40 transition-colors duration-150 ease-out hover:border-slate-500 hover:bg-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600/70"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-900/40 transition-all duration-150 ease-out hover:from-sky-400 hover:to-indigo-400 hover:shadow-md hover:ring-2 hover:ring-sky-400/50 hover:scale-[1.01] active:scale-95 active:translate-y-[1px] disabled:opacity-60"
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/30">
              <span className="text-xs font-bold">!</span>
            </div>
            <div>
              <p className="font-semibold">Sign in failed</p>
              <p className="text-rose-100/90">{error}</p>
            </div>
          </div>
        )}
        {success && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/30">
              <span className="text-xs font-bold">✓</span>
            </div>
            <div>
              <p className="font-semibold">Signed in</p>
              <p className="text-emerald-100/90">{success}</p>
            </div>
          </div>
        )}
        <footer className="text-center text-sm text-slate-400">
          Need an account?{" "}
          <Link className="font-semibold text-sky-400 hover:text-sky-300" href="/signup">
            Sign up
          </Link>
        </footer>
      </div>
      </div>
    </main>
  );
}


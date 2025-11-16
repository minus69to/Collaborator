"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

const navLinks = [
  { href: "/meetings", label: "Meetings" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppHeader() {
  const { status, user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.push("/");
    router.refresh();
  }

  return (
    // Hide header entirely for unauthenticated users
    status !== "authenticated" || !user ? null : (
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-gradient-to-b from-slate-950/80 via-slate-950/70 to-slate-900/80 text-slate-100 shadow-lg shadow-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-white drop-shadow-sm">
              Collaborator
            </span>
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-2.5 text-sm font-medium text-slate-300 sm:flex">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 border transition-all duration-150 ease-out ${
                    isActive
                      ? "bg-slate-900 text-white border-sky-500/60 shadow-sm shadow-sky-900/50"
                      : "border-slate-700/50 hover:bg-slate-900/80 hover:text-slate-100 hover:border-sky-500/40 hover:shadow-sm hover:shadow-slate-900/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 text-sm">
            {status === "authenticated" && user ? (
              <>
                <span className="hidden text-slate-300 sm:inline">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900 px-3 py-1.5 font-semibold text-slate-100 shadow-sm shadow-slate-950/40 transition-all duration-150 ease-out hover:bg-slate-800 hover:border-slate-500 hover:shadow-md hover:ring-2 hover:ring-slate-600/60 hover:scale-[1.02] active:scale-95 active:translate-y-[1px] disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>
    )
  );
}


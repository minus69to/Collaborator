"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/meetings", label: "Meetings" },
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
    <header className="border-b border-slate-800 bg-slate-950/80 text-slate-100 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          Collaborator
        </Link>

        <nav className="hidden gap-4 text-sm font-medium text-slate-300 sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 transition ${
                pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                  ? "bg-slate-800 text-white"
                  : "hover:bg-slate-900 hover:text-slate-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          {status === "authenticated" && user ? (
            <>
              <span className="hidden text-slate-300 sm:inline">{user.email}</span>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="rounded-md bg-slate-800 px-3 py-1.5 font-semibold text-slate-100 transition hover:bg-slate-700 disabled:opacity-60"
              >
                {isSigningOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="rounded-md px-3 py-1.5 font-semibold text-slate-100 hover:bg-slate-800">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-sky-500 px-3 py-1.5 font-semibold text-white transition hover:bg-sky-400"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


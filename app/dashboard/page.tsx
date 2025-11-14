"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";

type MeetingRecord = {
  meeting: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    created_at: string;
    ended_at?: string | null;
    host_id: string;
  };
  role: "host" | "participant";
  display_name?: string | null;
  joined_at: string;
  left_at?: string | null;
};

export default function DashboardPage() {
  const { status, user } = useUser();
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, [status]);

  async function fetchDashboard() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/meetings/dashboard");
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to load dashboard");
      }

      const payload = await response.json();
      setMeetings(payload.meetings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <p className="mb-4 text-slate-400">Please sign in to view your dashboard</p>
          <Link
            href="/login"
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold">Meeting Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            View all meetings you've created or joined
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-rose-500/20 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {meetings.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
            <div className="mb-4 text-6xl">📊</div>
            <p className="text-slate-400">No meetings yet</p>
            <Link
              href="/meetings"
              className="mt-4 inline-block rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              Create Your First Meeting
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map((record) => {
              const isHost = record.role === "host";
              const isActive = record.meeting.status === "active";
              const isEnded = record.meeting.status === "ended";

              return (
                <article
                  key={`${record.meeting.id}-${record.joined_at}`}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 shadow shadow-slate-950/40"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{record.meeting.title}</h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isHost
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {isHost ? "👑 Host" : "👤 Participant"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isActive
                              ? "bg-green-500/20 text-green-400"
                              : isEnded
                              ? "bg-slate-500/20 text-slate-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {isActive ? "Active" : isEnded ? "Ended" : "Scheduled"}
                        </span>
                      </div>
                      {record.meeting.description && (
                        <p className="mt-2 text-sm text-slate-300">
                          {record.meeting.description}
                        </p>
                      )}
                      <div className="mt-3 space-y-1 text-xs text-slate-400">
                        <p>
                          Joined: {new Date(record.joined_at).toLocaleString()}
                          {record.display_name && ` as "${record.display_name}"`}
                        </p>
                        {record.left_at && (
                          <p>Left: {new Date(record.left_at).toLocaleString()}</p>
                        )}
                        {record.meeting.ended_at && (
                          <p>Meeting ended: {new Date(record.meeting.ended_at).toLocaleString()}</p>
                        )}
                        <p>Created: {new Date(record.meeting.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {isActive && (
                      <Link
                        href={`/meeting/${record.meeting.id}`}
                        className="ml-4 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                      >
                        {isHost ? "Host Meeting" : "Join Again"}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}


"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

type Meeting = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  hms_room_id?: string | null;
};

export default function MeetingsPage() {
  const router = useRouter();
  const { status, user } = useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingIdToJoin, setMeetingIdToJoin] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchMeetings();
    } else if (status === "unauthenticated") {
      setMeetings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function fetchMeetings(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user) {
      setError("Sign in to load meetings.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/meetings/list");
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to load meetings");
      }

      const payload = (await response.json()) as { meetings: Meeting[] };
      setMeetings(payload.meetings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMeetings([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function createMeeting(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Meeting title is required.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/meetings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to create meeting");
      }

      const payload = await response.json();
      setSuccess(`Created meeting "${payload.meeting.title}"`);
      setTitle("");
      setDescription("");
      await fetchMeetings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsCreating(false);
    }
  }

  async function joinMeetingById(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedId = meetingIdToJoin.trim();
    
    if (!trimmedId) {
      setError("Meeting ID is required.");
      return;
    }

    // Basic validation: Meeting IDs are UUIDs (36 characters with dashes)
    // Allow some flexibility but check for basic format
    if (trimmedId.length < 10) {
      setError("Invalid meeting ID format. Meeting IDs are typically longer.");
      return;
    }

    setIsJoining(true);
    try {
      // First, verify the meeting exists and user can access it
      const response = await fetch(`/api/meetings/get?meetingId=${encodeURIComponent(trimmedId)}`);
      
      if (!response.ok) {
        let errorMessage = "Meeting not found or you don't have access";
        
        // Try to parse error message from response
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const payload = await response.json();
            errorMessage = payload.error || payload.message || errorMessage;
          } else {
            // If not JSON, use status text
            errorMessage = response.statusText || errorMessage;
          }
        } catch (parseError) {
          // If parsing fails, use status-based messages
          if (response.status === 404) {
            errorMessage = "Meeting not found";
          } else if (response.status === 400) {
            errorMessage = "Invalid meeting ID";
          } else if (response.status === 403) {
            errorMessage = "You don't have permission to access this meeting";
          } else if (response.status >= 500) {
            errorMessage = "Server error. Please try again later";
          }
        }
        
        throw new Error(errorMessage);
      }

      // If meeting exists, navigate to the meeting page
      router.push(`/meeting/${trimmedId}`);
    } catch (err) {
      // Handle network errors and other exceptions
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to join meeting");
      }
      setIsJoining(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Meetings</h1>
          <p className="mt-1 text-sm text-slate-300">
            {status === "authenticated"
              ? `Welcome back, ${user?.email ?? "teammate"}!`
              : "Sign in to create and manage your meetings."}
          </p>
        </header>

        {status === "unauthenticated" && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-6 text-center text-sm text-slate-300 shadow-lg shadow-slate-950/60">
            <p>
              Please{" "}
              <Link className="font-semibold text-sky-400 hover:text-sky-300" href="/login">
                sign in
              </Link>{" "}
              or{" "}
              <Link className="font-semibold text-sky-400 hover:text-sky-300" href="/signup">
                create an account
              </Link>{" "}
              to manage meetings.
            </p>
          </div>
        )}

        {status === "authenticated" && (
          <section className="grid w-full gap-6 lg:grid-cols-2">
            <form
              onSubmit={createMeeting}
              className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-slate-950 p-6 shadow-xl shadow-slate-900/70 backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-2xl hover:shadow-sky-900/60"
            >
              <h2 className="text-lg font-semibold text-white">Create meeting</h2>
              <label className="text-sm font-medium text-slate-200">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Weekly Sync"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm shadow-slate-950/40 transition-colors duration-150 ease-out hover:border-slate-500 hover:bg-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600/70"
                />
              </label>
              <label className="text-sm font-medium text-slate-200">
                Description (optional)
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Discuss project updates and blockers…"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm shadow-slate-950/40 transition-colors duration-150 ease-out hover:border-slate-500 hover:bg-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600/70"
                  rows={3}
                />
              </label>
              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-900/40 transition-all duration-150 ease-out hover:from-sky-400 hover:to-indigo-400 hover:shadow-md hover:ring-2 hover:ring-sky-400/50 hover:scale-[1.01] active:scale-95 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreating}
              >
                {isCreating ? "Creating…" : "Create meeting"}
              </button>
            </form>

            <form
              onSubmit={joinMeetingById}
              className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-slate-950 p-6 shadow-xl shadow-slate-900/70 backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-900/60"
            >
              <h2 className="text-lg font-semibold text-white">Join by Meeting ID</h2>
              <p className="text-xs text-slate-400">Enter a meeting ID to join an existing meeting.</p>
              <label className="text-sm font-medium text-slate-200">
                Meeting ID
                <input
                  type="text"
                  value={meetingIdToJoin}
                  onChange={(event) => setMeetingIdToJoin(event.target.value)}
                  placeholder="1dfc7cc9-744c-4054-be05-09d1d0c32139"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm shadow-slate-950/40 transition-colors duration-150 ease-out hover:border-slate-500 hover:bg-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600/70"
                />
              </label>
              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-900/40 transition-all duration-150 ease-out hover:from-emerald-400 hover:to-teal-400 hover:shadow-md hover:ring-2 hover:ring-emerald-400/50 hover:scale-[1.01] active:scale-95 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isJoining || !meetingIdToJoin.trim()}
              >
                {isJoining ? "Joining…" : "Join meeting"}
              </button>
            </form>
          </section>
        )}

        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/30">
              <span className="text-xs font-bold">!</span>
            </div>
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="text-rose-100/90">{error}</p>
            </div>
          </div>
        )}
        {success && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/30">
              <span className="text-xs font-bold">✓</span>
            </div>
            <div>
              <p className="font-semibold">All set</p>
              <p className="text-emerald-100/90">{success}</p>
            </div>
          </div>
        )}

        <section className="w-full space-y-3">
          {meetings.length === 0 && !isLoading && !error && (
            <p className="text-center text-sm text-slate-400">No meetings yet.</p>
          )}
          {meetings.map((meeting) => (
            <article
              key={meeting.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 shadow shadow-slate-950/40 transition-transform duration-200 hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-900/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-white">{meeting.title}</h2>
                  <p className="text-sm text-slate-300">Status: {meeting.status}</p>
                  <p className="text-xs text-slate-500">
                    Created: {new Date(meeting.created_at).toLocaleString()}
                  </p>
                  {meeting.hms_room_id && (
                    <p className="mt-2 text-xs text-slate-400">
                      Room ID: {meeting.hms_room_id.substring(0, 12)}...
                    </p>
                  )}
                </div>
                {meeting.hms_room_id && (
                  <Link
                    href={`/meeting/${meeting.id}`}
                    className="ml-4 inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-900/40 transition-all duration-150 ease-out hover:bg-sky-400 hover:shadow-md hover:ring-2 hover:ring-sky-400/50 hover:scale-[1.01] active:scale-95 active:translate-y-[1px]"
                  >
                    Join meeting
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}


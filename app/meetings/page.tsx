"use client";

import { FormEvent, useState } from "react";

type Meeting = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export default function MeetingsPage() {
  const [hostId, setHostId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function fetchMeetings(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setSuccess(null);

    if (!hostId) {
      setError("Enter a host ID to load meetings.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/meetings/list?hostId=${encodeURIComponent(hostId)}`);
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

    if (!hostId || !title.trim()) {
      setError("Host ID and meeting title are required.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/meetings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId,
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

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-slate-950 px-6 py-16 text-slate-100">
      <header className="text-center">
        <h1 className="text-3xl font-semibold">Meetings</h1>
        <p className="text-sm text-slate-300">Enter a host ID to create and load meetings from Supabase.</p>
      </header>

      <section className="grid w-full max-w-4xl gap-6 lg:grid-cols-2">
        <form onSubmit={createMeeting} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">Create meeting</h2>
          <label className="text-sm font-medium text-slate-200">
            Host ID
            <input
              value={hostId}
              onChange={(event) => setHostId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000001"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Weekly Sync"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Description (optional)
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Discuss project updates and blockers…"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600"
              rows={3}
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
          >
            {isCreating ? "Creating…" : "Create meeting"}
          </button>
        </form>

        <form onSubmit={fetchMeetings} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">Load meetings</h2>
          <p className="text-xs text-slate-400">Host ID is shared with the create form.</p>
          <button
            type="submit"
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Loading…" : "Refresh list"}
          </button>
        </form>
      </section>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {success && <p className="text-sm text-emerald-300">{success}</p>}

      <section className="w-full max-w-3xl space-y-3">
        {meetings.length === 0 && !isLoading && !error && (
          <p className="text-sm text-slate-400 text-center">No meetings yet.</p>
        )}
        {meetings.map((meeting) => (
          <article
            key={meeting.id}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 shadow shadow-slate-950/40"
          >
            <h2 className="text-lg font-semibold text-white">{meeting.title}</h2>
            <p className="text-sm text-slate-300">Status: {meeting.status}</p>
            <p className="text-xs text-slate-500">Created: {new Date(meeting.created_at).toLocaleString()}</p>
          </article>
        ))}
      </section>
    </main>
  );
}


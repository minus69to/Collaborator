"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";

// Helper function to get initials from name/email
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s@]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
}

// Helper function to get a color based on name (for avatar)
function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-red-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

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

type ChatMessage = {
  id: string;
  meeting_id: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
};

type FileRecord = {
  id: string;
  meeting_id: string;
  user_id: string;
  display_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
};

type RecordingRecord = {
  id: string;
  meeting_id: string;
  hms_recording_id: string;
  started_by: string;
  display_name: string;
  status: string;
  url: string | null;
  started_at: string;
  stopped_at: string | null;
  stopped_by: string | null;
  auto_stopped: boolean;
  duration: number | null;
  file_size: number | null;
  created_at: string;
};

export default function DashboardPage() {
  const { status, user } = useUser();
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Chat history state
  const [expandedChatMeetings, setExpandedChatMeetings] = useState<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [loadingChat, setLoadingChat] = useState<Set<string>>(new Set());
  const chatEndRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Files history state
  const [expandedFilesMeetings, setExpandedFilesMeetings] = useState<Set<string>>(new Set());
  const [meetingFiles, setMeetingFiles] = useState<Map<string, FileRecord[]>>(new Map());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  
  // Recordings history state
  const [expandedRecordingsMeetings, setExpandedRecordingsMeetings] = useState<Set<string>>(new Set());
  const [meetingRecordings, setMeetingRecordings] = useState<Map<string, RecordingRecord[]>>(new Map());
  const [loadingRecordings, setLoadingRecordings] = useState<Set<string>>(new Set());
  
  // Insights (Transcript & Summary) state
  const [expandedInsightsMeetings, setExpandedInsightsMeetings] = useState<Set<string>>(new Set());
  const [meetingInsights, setMeetingInsights] = useState<Map<string, any[]>>(new Map());
  const [loadingInsights, setLoadingInsights] = useState<Set<string>>(new Set());
  const [insightContentByRecording, setInsightContentByRecording] = useState<Map<string, { transcriptText: string | null; summaryText: string | null; loading: boolean; error?: string }>>(new Map());

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, [status]);

  // Poll for recording updates when recordings modal is open
  useEffect(() => {
    if (expandedRecordingsMeetings.size === 0) {
      return;
    }

    // Check if any recordings need updating (don't have URLs yet)
    const hasRecordingsWithoutUrls = Array.from(expandedRecordingsMeetings).some((meetingId) => {
      const recordings = meetingRecordings.get(meetingId);
      return recordings && recordings.some((rec: RecordingRecord) => !rec.url && rec.hms_recording_id);
    });

    if (!hasRecordingsWithoutUrls) {
      // All recordings have URLs, no need to poll
      return;
    }

    const intervalId = setInterval(() => {
      // Refresh recordings for all open modals (silently, without showing loading)
      expandedRecordingsMeetings.forEach((meetingId) => {
        fetchRecordingsHistory(meetingId, true);
      });
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [expandedRecordingsMeetings, meetingRecordings]);

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

  // Fetch chat messages for a meeting
  async function fetchChatHistory(meetingId: string) {
    if (chatMessages.has(meetingId)) {
      // Already loaded, just toggle visibility
      setExpandedChatMeetings(prev => {
        const newSet = new Set(prev);
        if (newSet.has(meetingId)) {
          newSet.delete(meetingId);
        } else {
          newSet.add(meetingId);
        }
        return newSet;
      });
      // Scroll to bottom after opening
      setTimeout(() => {
        const ref = chatEndRefs.current.get(meetingId);
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return;
    }

    setLoadingChat(prev => new Set(prev).add(meetingId));
    try {
      const response = await fetch(`/api/messages?meetingId=${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];
        setChatMessages(prev => {
          const newMap = new Map(prev);
          newMap.set(meetingId, messages);
          return newMap;
        });
        // Expand chat history after loading
        setExpandedChatMeetings(prev => new Set(prev).add(meetingId));
        // Scroll to bottom after opening
        setTimeout(() => {
          const ref = chatEndRefs.current.get(meetingId);
          if (ref) {
            ref.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch chat history:", errorData.error);
      }
    } catch (err) {
      console.error("Error fetching chat history:", err);
    } finally {
      setLoadingChat(prev => {
        const newSet = new Set(prev);
        newSet.delete(meetingId);
        return newSet;
      });
    }
  }

  // Toggle chat history visibility
  function toggleChatHistory(meetingId: string) {
    if (!chatMessages.has(meetingId)) {
      // Not loaded yet, fetch it
      fetchChatHistory(meetingId);
    } else {
      // Already loaded, just toggle visibility
      setExpandedChatMeetings(prev => {
        const newSet = new Set(prev);
        if (newSet.has(meetingId)) {
          newSet.delete(meetingId);
        } else {
          newSet.add(meetingId);
          // Scroll to bottom when opening
          setTimeout(() => {
            const ref = chatEndRefs.current.get(meetingId);
            if (ref) {
              ref.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
        }
        return newSet;
      });
    }
  }

  // Fetch files for a meeting
  async function fetchFilesHistory(meetingId: string) {
    if (meetingFiles.has(meetingId)) {
      // Already loaded, just toggle visibility
      setExpandedFilesMeetings(prev => {
        const newSet = new Set(prev);
        if (newSet.has(meetingId)) {
          newSet.delete(meetingId);
        } else {
          newSet.add(meetingId);
        }
        return newSet;
      });
      return;
    }

    setLoadingFiles(prev => new Set(prev).add(meetingId));
    try {
      const response = await fetch(`/api/files/list?meetingId=${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        const files = data.files || [];
        setMeetingFiles(prev => {
          const newMap = new Map(prev);
          newMap.set(meetingId, files);
          return newMap;
        });
        // Expand files history after loading
        setExpandedFilesMeetings(prev => new Set(prev).add(meetingId));
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch files history:", errorData.error);
      }
    } catch (err) {
      console.error("Error fetching files history:", err);
    } finally {
      setLoadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(meetingId);
        return newSet;
      });
    }
  }

  // Toggle files history visibility
  function toggleFilesHistory(meetingId: string) {
    if (!meetingFiles.has(meetingId)) {
      // Not loaded yet, fetch it
      fetchFilesHistory(meetingId);
    } else {
      // Already loaded, just toggle visibility
      setExpandedFilesMeetings(prev => {
        const newSet = new Set(prev);
        if (newSet.has(meetingId)) {
          newSet.delete(meetingId);
        } else {
          newSet.add(meetingId);
        }
        return newSet;
      });
    }
  }

  // Fetch recordings for a meeting
  async function fetchRecordingsHistory(meetingId: string, silent = false) {
    // If silent, skip loading state and toggle logic (for polling)
    if (!silent && meetingRecordings.has(meetingId)) {
      // Already loaded, just toggle visibility
      setExpandedRecordingsMeetings(prev => {
        const newSet = new Set(prev);
        if (newSet.has(meetingId)) {
          newSet.delete(meetingId);
        } else {
          newSet.add(meetingId);
        }
        return newSet;
      });
      return;
    }

    if (!silent) {
      setLoadingRecordings(prev => new Set(prev).add(meetingId));
    }
    try {
      const response = await fetch(`/api/recordings/list?meetingId=${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        const recordings = data.recordings || [];
        setMeetingRecordings(prev => {
          const newMap = new Map(prev);
          newMap.set(meetingId, recordings);
          return newMap;
        });
        // Expand recordings history after loading (only if not silent)
        if (!silent) {
          setExpandedRecordingsMeetings(prev => new Set(prev).add(meetingId));
        }
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch recordings history:", errorData.error);
      }
    } catch (err) {
      console.error("Error fetching recordings history:", err);
    } finally {
      if (!silent) {
        setLoadingRecordings(prev => {
          const newSet = new Set(prev);
          newSet.delete(meetingId);
          return newSet;
        });
      }
    }
  }

  // Toggle recordings history visibility
  function toggleRecordingsHistory(meetingId: string) {
    if (!meetingRecordings.has(meetingId)) {
      // Not loaded yet, fetch it
      fetchRecordingsHistory(meetingId);
    } else {
      // Already loaded, just toggle visibility
      setExpandedRecordingsMeetings(prev => {
        const newSet = new Set(prev);
        if (newSet.has(meetingId)) {
          newSet.delete(meetingId);
        } else {
          newSet.add(meetingId);
        }
        return newSet;
      });
    }
  }

  // Fetch insights list for a meeting
  async function fetchInsightsList(meetingId: string) {
    if (meetingInsights.has(meetingId)) {
      setExpandedInsightsMeetings(prev => {
        const next = new Set(prev);
        if (next.has(meetingId)) next.delete(meetingId);
        else next.add(meetingId);
        return next;
      });
      return;
    }
    setLoadingInsights(prev => new Set(prev).add(meetingId));
    try {
      const res = await fetch(`/api/insights/list?meetingId=${meetingId}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to load transcript & summary list");
      }
      const data = await res.json();
      const items = data.items || [];
      setMeetingInsights(prev => {
        const next = new Map(prev);
        next.set(meetingId, items);
        return next;
      });
      setExpandedInsightsMeetings(prev => new Set(prev).add(meetingId));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to load transcript & summary list");
    } finally {
      setLoadingInsights(prev => {
        const next = new Set(prev);
        next.delete(meetingId);
        return next;
      });
    }
  }

  function toggleInsights(meetingId: string) {
    if (!meetingInsights.has(meetingId)) {
      fetchInsightsList(meetingId);
    } else {
      setExpandedInsightsMeetings(prev => {
        const next = new Set(prev);
        if (next.has(meetingId)) next.delete(meetingId);
        else next.add(meetingId);
        return next;
      });
    }
  }

  async function openInsight(recordingId: string) {
    setInsightContentByRecording(prev => {
      const next = new Map(prev);
      next.set(recordingId, { transcriptText: null, summaryText: null, loading: true });
      return next;
    });
    try {
      const res = await fetch(`/api/insights/fetch?recordingId=${recordingId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to fetch transcript/summary");
      }
      setInsightContentByRecording(prev => {
        const next = new Map(prev);
        next.set(recordingId, { transcriptText: data.transcriptText || null, summaryText: data.summaryText || null, loading: false });
        return next;
      });
    } catch (e) {
      setInsightContentByRecording(prev => {
        const next = new Map(prev);
        next.set(recordingId, { transcriptText: null, summaryText: null, loading: false, error: e instanceof Error ? e.message : "Failed to fetch" });
        return next;
      });
    }
  }

  // Helpers to render transcript/summary nicely
  function renderTranscriptPretty(raw: string | null) {
    if (!raw) return null;
    // Try JSON parse to extract segments or text
    try {
      const json = JSON.parse(raw);
      // Common shapes: { transcript: string } | { text: string } | { segments: [{ speaker, start, end, text }] }
      const textOnly =
        (json && (json.transcript || json.text)) as string | undefined;
      if (textOnly && typeof textOnly === "string") {
        return (
          <div className="space-y-3 leading-7">
            {textOnly.split(/\n{2,}/).map((para: string, idx: number) => (
              <p key={idx} className="text-slate-100 whitespace-pre-wrap break-words">
                {para.trim()}
              </p>
            ))}
          </div>
        );
      }
      // Structured segments array
      if (Array.isArray(json?.segments)) {
        const segments: any[] = json.segments;
        return (
          <div className="space-y-3 leading-7">
            {segments.map((seg: any, idx: number) => {
              const speaker =
                seg.speaker || seg.speaker_name || seg.speakerId || "Speaker";
              const line: string = seg.text || "";
              return (
                <div key={idx} className="space-y-1">
                  <div className="text-xs text-slate-400">
                    {typeof speaker === "string" ? speaker : "Speaker"}
                    {seg.start != null && seg.end != null && (
                      <span className="ml-2">
                        [{Math.floor(seg.start)}s – {Math.floor(seg.end)}s]
                      </span>
                    )}
                  </div>
                  <p className="text-slate-100 whitespace-pre-wrap break-words">{line}</p>
                </div>
              );
            })}
          </div>
        );
      }
      // Some providers return an array of content blocks [{ title, paragraph, bullets }]
      if (Array.isArray(json)) {
        const blocks: any[] = json;
        const paragraphs: string[] = [];
        const bullets: string[] = [];
        blocks.forEach((b: any) => {
          if (typeof b?.paragraph === "string" && b.paragraph.trim().length) {
            paragraphs.push(b.paragraph.trim());
          }
          if (Array.isArray(b?.bullets)) {
            b.bullets.forEach((it: any) => {
              if (typeof it === "string" && it.trim().length) {
                bullets.push(it.trim());
              }
            });
          }
        });
        return (
          <div className="space-y-4 leading-7">
            {paragraphs.length > 0 && (
              <div className="space-y-3">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-slate-100 whitespace-pre-wrap break-words">
                    {p}
                  </p>
                ))}
              </div>
            )}
            {bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {bullets.map((b, i) => (
                  <li key={i} className="text-slate-100">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {paragraphs.length === 0 && bullets.length === 0 && (
              <p className="text-slate-300">Transcript not available.</p>
            )}
          </div>
        );
      }
      // Fallback to pretty JSON string if unknown
      const fallback =
        typeof json === "string"
          ? json
          : (json?.paragraph as string) ||
            (Array.isArray(json?.bullets) ? json.bullets.join("\n") : "");
      if (fallback) {
        return (
          <div className="space-y-3 leading-7">
            {fallback.split(/\n{2,}/).map((para: string, idx: number) => (
              <p key={idx} className="text-slate-100 whitespace-pre-wrap break-words">
                {para.trim()}
              </p>
            ))}
          </div>
        );
      }
      return <p className="text-slate-300">Transcript not available.</p>;
    } catch {
      // Treat as plain text
      return (
        <div className="space-y-3 leading-7">
          {raw.split(/\n{2,}/).map((para: string, idx: number) => (
            <p key={idx} className="text-slate-100 whitespace-pre-wrap break-words">
              {para.trim()}
            </p>
          ))}
        </div>
      );
    }
  }

  function renderSummaryPretty(raw: string | null) {
    if (!raw) return null;
    try {
      const json = JSON.parse(raw);
      // If the summary is an array of blocks
      if (Array.isArray(json)) {
        const blocks: any[] = json;
        const bulletsAgg: string[] = [];
        const paragraphsAgg: string[] = [];
        blocks.forEach((b: any) => {
          if (Array.isArray(b?.bullets)) {
            b.bullets.forEach((it: any) => {
              if (typeof it === "string" && it.trim().length) {
                bulletsAgg.push(it.trim());
              }
            });
          }
          if (typeof b?.paragraph === "string" && b.paragraph.trim().length) {
            paragraphsAgg.push(b.paragraph.trim());
          }
        });
        return (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">AI Summary</h3>
            {bulletsAgg.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {bulletsAgg.map((b, i) => (
                  <li key={i} className="text-slate-100">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {paragraphsAgg.length > 0 && (
              <div className="space-y-3">
                {paragraphsAgg.map((p, i) => (
                  <p key={i} className="text-slate-100 whitespace-pre-wrap break-words leading-7">
                    {p}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      }
      const title: string | undefined = json.title || json.heading || "AI Summary";
      const bullets: string[] | undefined =
        (Array.isArray(json.bullets) && json.bullets) ||
        (Array.isArray(json.points) && json.points);
      const paragraph: string | undefined =
        json.paragraph || json.text || json.summary || json.ai_summary;
      return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {bullets && bullets.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {bullets.map((b: string, i: number) => (
                <li key={i} className="text-slate-100">
                  {b}
                </li>
              ))}
            </ul>
          )}
          {paragraph && (
            <p className="text-slate-100 whitespace-pre-wrap break-words leading-7">
              {paragraph}
            </p>
          )}
        </div>
      );
    } catch {
      // Plain text fallback
      return (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white">AI Summary</h3>
          <p className="text-slate-100 whitespace-pre-wrap break-words leading-7">
            {raw}
          </p>
        </div>
      );
    }
  }

  // Handle file download
  async function handleFileDownload(fileId: string, fileName: string) {
    try {
      const response = await fetch(`/api/files/download?fileId=${fileId}`);
      if (response.ok) {
        const data = await response.json();
        // Fetch the file as a blob to force download (works with cross-origin URLs)
        const fileResponse = await fetch(data.file.download_url);
        const blob = await fileResponse.blob();
        
        // Create object URL from blob
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Create a temporary anchor element to force download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = 'none';
        // Append to body, click, then remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up object URL after a short delay
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      } else {
        const errorData = await response.json();
        console.error("Failed to download file:", errorData.error);
        alert(errorData.error || "Failed to download file");
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("Failed to download file");
    }
  }

  // Handle recording download - following the same pattern as file downloads
  async function handleRecordingDownload(recordingUrl: string, recordingId: string, meetingId: string, displayName: string, startedAt: string) {
    try {
      console.log(`[Recording Download Client] Starting download for recording ${recordingId}...`);
      
      // Step 1: Get signed download URL from server (authenticated endpoint)
      const downloadUrlResponse = await fetch(
        `/api/recordings/download-url?recordingId=${recordingId}&meetingId=${meetingId}`,
        {
          method: 'GET',
          credentials: 'include', // Send cookies for authentication
        }
      );
      
      if (!downloadUrlResponse.ok) {
        const errorData = await downloadUrlResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error("Failed to get download URL:", errorData.error);
        throw new Error(errorData.error || `Failed to get download URL: ${downloadUrlResponse.status}`);
      }
      
      const { ok, downloadUrl, error } = await downloadUrlResponse.json();
      
      if (!ok || !downloadUrl) {
        throw new Error(error || "Download URL not available");
      }
      
      console.log(`[Recording Download Client] Got download URL from server`);
      
      // Step 2: Fetch the file directly from the signed URL (works with cross-origin URLs)
      const fileResponse = await fetch(downloadUrl, {
        method: 'GET',
        redirect: 'follow',
      });
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      
      const blob = await fileResponse.blob();
      console.log(`[Recording Download Client] Received blob: ${blob.size} bytes, type: ${blob.type}`);
      
      // Check if we got actual video data
      if (blob.size < 1000) {
        throw new Error(`File too small: ${blob.size} bytes - may be an error response`);
      }
      
      // Generate filename
      const dateStr = new Date(startedAt).toISOString().split('T')[0];
      const timeStr = new Date(startedAt).toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `recording-${displayName}-${dateStr}-${timeStr}.mp4`;
      
      // Create blob URL and trigger download (same pattern as file downloads)
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after download
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      console.log(`[Recording Download Client] ✓ Download started for ${fileName}`);
      
    } catch (err) {
      console.error("Error downloading recording:", err);
      alert(`Failed to download recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
        <p className="text-sm text-slate-300">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Meeting Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            View all meetings you've created or joined.
          </p>
        </header>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/40">
              <span className="text-xs font-bold">!</span>
            </div>
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="text-rose-100/90">{error}</p>
            </div>
          </div>
        )}

        {meetings.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-8 text-center shadow-lg shadow-slate-950/60 backdrop-blur-md">
            <div className="mb-4 text-6xl">📊</div>
            <p className="text-slate-400">No meetings yet</p>
            <Link
              href="/meetings"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-900/40 transition-all duration-150 ease-out hover:from-sky-400 hover:to-indigo-400 hover:shadow-md hover:ring-2 hover:ring-sky-400/50 hover:scale-[1.02] active:scale-95 active:translate-y-[1px]"
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
                  key={record.meeting.id}
                  className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950 p-4 shadow-lg shadow-slate-950/50 transition-transform duration-200 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-900/60"
                >
                  <div className="flex items-center justify-between gap-4">
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
                    <div className="flex flex-wrap items-center gap-2">
                      {isActive && (
                        <Link
                          href={`/meeting/${record.meeting.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 text-xs md:text-sm font-semibold text-white shadow-sm shadow-sky-900/40 transition-all duration-150 ease-out hover:from-sky-400 hover:to-indigo-400 hover:shadow-md hover:ring-2 hover:ring-sky-400/50 hover:scale-[1.01] active:scale-95 active:translate-y-[1px]"
                        >
                          {isHost ? "Host Meeting" : "Join Again"}
                        </Link>
                      )}
                      <button
                        onClick={() => toggleChatHistory(record.meeting.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 px-3 text-xs md:text-sm font-semibold text-slate-100 shadow-sm shadow-slate-950/40 transition-all duration-150 ease-out hover:bg-slate-800 hover:border-sky-400/50 hover:text-white hover:shadow-md active:scale-95"
                        disabled={loadingChat.has(record.meeting.id)}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                        {loadingChat.has(record.meeting.id) ? "Loading..." : "Chat"}
                      </button>
                      
                      <button
                        onClick={() => toggleFilesHistory(record.meeting.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 px-3 text-xs md:text-sm font-semibold text-slate-100 shadow-sm shadow-slate-950/40 transition-all duration-150 ease-out hover:bg-slate-800 hover:border-sky-400/50 hover:text-white hover:shadow-md active:scale-95"
                        disabled={loadingFiles.has(record.meeting.id)}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        {loadingFiles.has(record.meeting.id) ? "Loading..." : "Files"}
                      </button>
                      
                      <button
                        onClick={() => toggleRecordingsHistory(record.meeting.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 px-3 text-xs md:text-sm font-semibold text-slate-100 shadow-sm shadow-slate-950/40 transition-all duration-150 ease-out hover:bg-slate-800 hover:border-sky-400/50 hover:text-white hover:shadow-md active:scale-95"
                        disabled={loadingRecordings.has(record.meeting.id)}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        {loadingRecordings.has(record.meeting.id) ? "Loading..." : "Recordings"}
                      </button>
                      
                      <button
                        onClick={() => toggleInsights(record.meeting.id)}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 px-3 text-xs md:text-sm font-semibold text-slate-100 shadow-sm shadow-slate-950/40 transition-all duration-150 ease-out hover:bg-slate-800 hover:border-sky-400/50 hover:text-white hover:shadow-md active:scale-95"
                        disabled={loadingInsights.has(record.meeting.id)}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
                        </svg>
                        {loadingInsights.has(record.meeting.id) ? "Loading..." : "Transcript & Summary"}
                      </button>
                    </div>
                  </div>
                  {record.meeting.description && (
                    <p className="mt-2 text-sm text-slate-300">
                      {record.meeting.description}
                    </p>
                  )}
                  <div className="mt-2.5 space-y-1 text-xs text-slate-400">
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
                </article>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Chat History Modal */}
      {Array.from(expandedChatMeetings).map((meetingId) => {
        const messages = chatMessages.get(meetingId);
        const meeting = meetings.find(r => r.meeting.id === meetingId);
        
        return (
          <div key={meetingId}>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => toggleChatHistory(meetingId)}
            />
            
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-slate-950/80 backdrop-blur-md max-h-[85vh] flex flex-col transition-all duration-200 ease-out">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Chat History
                  </h2>
                  {meeting && (
                    <p className="text-sm text-slate-400 mt-1">
                      {meeting.meeting.title}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleChatHistory(meetingId)}
                  className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Messages List */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {!messages || messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-center text-slate-400">No chat messages for this meeting.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg: ChatMessage) => {
                      const isLocalMessage = msg.user_id === user?.id;
                      const avatarColor = getAvatarColor(msg.display_name || "");
                      const initials = getInitials(msg.display_name || "");
                      const timestamp = new Date(msg.created_at);
                      const dateString = timestamp.toLocaleDateString();
                      const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${isLocalMessage ? 'flex-row-reverse' : ''}`}
                        >
                          {/* Avatar */}
                          <div className={`${avatarColor} flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white`}>
                            {initials}
                          </div>
                          
                          {/* Message Content */}
                          <div className={`flex flex-col max-w-[75%] ${isLocalMessage ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-white">
                                {isLocalMessage ? 'You' : msg.display_name}
                              </span>
                              <span className="text-xs text-slate-400">
                                {dateString} {timeString}
                              </span>
                            </div>
                            <div className={`rounded-lg px-3 py-2 ${
                              isLocalMessage 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-slate-700 text-slate-100'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Scroll anchor */}
                    <div ref={(el) => {
                      if (el) {
                        chatEndRefs.current.set(meetingId, el);
                      }
                    }} />
                  </div>
                )}
              </div>
              
              {/* Footer with message count */}
              <div className="border-t border-slate-700 px-5 py-3">
                <p className="text-xs text-slate-400 text-center">
                  {messages && messages.length > 0 
                    ? `${messages.length} message${messages.length === 1 ? '' : 's'}`
                    : 'No messages'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Files History Modal */}
      {Array.from(expandedFilesMeetings).map((meetingId) => {
        const files = meetingFiles.get(meetingId);
        const meeting = meetings.find(r => r.meeting.id === meetingId);
        
        return (
          <div key={meetingId}>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => toggleFilesHistory(meetingId)}
            />
            
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-slate-950/80 backdrop-blur-md max-h-[85vh] flex flex-col transition-all duration-200 ease-out">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Files
                  </h2>
                  {meeting && (
                    <p className="text-sm text-slate-400 mt-1">
                      {meeting.meeting.title}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleFilesHistory(meetingId)}
                  className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Files List */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {!files || files.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-center text-slate-400">No files uploaded for this meeting.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file: FileRecord) => {
                      const isLocalFile = file.user_id === user?.id;
                      const timestamp = new Date(file.uploaded_at);
                      const dateString = timestamp.toLocaleDateString();
                      const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const fileSizeMB = (file.file_size / 1024 / 1024).toFixed(2);
                      
                      // Get file icon based on mime type
                      const getFileIcon = (mimeType: string) => {
                        if (mimeType.startsWith('image/')) return '🖼️';
                        if (mimeType.startsWith('video/')) return '🎥';
                        if (mimeType.startsWith('audio/')) return '🎵';
                        if (mimeType.includes('pdf')) return '📄';
                        if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
                        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
                        if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
                        return '📎';
                      };
                      
                      return (
                        <div
                          key={file.id}
                          className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 transition hover:bg-slate-900"
                        >
                          {/* File Icon */}
                          <div className="flex-shrink-0 text-2xl">
                            {getFileIcon(file.mime_type)}
                          </div>
                          
                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate" title={file.file_name}>
                                  {file.file_name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-400">
                                    {isLocalFile ? 'You' : file.display_name}
                                  </span>
                                  <span className="text-xs text-slate-500">•</span>
                                  <span className="text-xs text-slate-400">
                                    {dateString} {timeString}
                                  </span>
                                  <span className="text-xs text-slate-500">•</span>
                                  <span className="text-xs text-slate-400">
                                    {fileSizeMB} MB
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleFileDownload(file.id, file.file_name)}
                              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-blue-400"
                              title="Download"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer with file count */}
              <div className="border-t border-slate-700 px-5 py-3">
                <p className="text-xs text-slate-400 text-center">
                  {files && files.length > 0 
                    ? `${files.length} file${files.length === 1 ? '' : 's'}`
                    : 'No files'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Recordings History Modal */}
      {Array.from(expandedRecordingsMeetings).map((meetingId) => {
        const recordings = meetingRecordings.get(meetingId);
        const meeting = meetings.find(r => r.meeting.id === meetingId);
        
        return (
          <div key={meetingId}>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => toggleRecordingsHistory(meetingId)}
            />
            
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-slate-950/80 backdrop-blur-md max-h-[85vh] flex flex-col transition-all duration-200 ease-out">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Recordings
                  </h2>
                  {meeting && (
                    <p className="text-sm text-slate-400 mt-1">
                      {meeting.meeting.title}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleRecordingsHistory(meetingId)}
                  className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Recordings List */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {!recordings || recordings.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-center text-slate-400">No recordings for this meeting.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recordings.map((recording: RecordingRecord) => {
                      const startedAt = new Date(recording.started_at);
                      const stoppedAt = recording.stopped_at ? new Date(recording.stopped_at) : null;
                      const duration = recording.duration || (stoppedAt ? Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000) : null);
                      const durationMinutes = duration ? Math.floor(duration / 60) : null;
                      const durationSeconds = duration ? duration % 60 : null;
                      const fileSizeMB = recording.file_size ? (recording.file_size / 1024 / 1024).toFixed(2) : null;
                      
                      // Generate filename
                      const dateStr = new Date(recording.started_at).toISOString().split('T')[0];
                      const timeStr = new Date(recording.started_at).toTimeString().split(' ')[0].replace(/:/g, '-');
                      const fileName = `recording-${recording.display_name}-${dateStr}-${timeStr}.mp4`;
                      
                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case 'completed':
                            return 'bg-green-600';
                          case 'recording':
                          case 'running':
                          case 'starting':
                            return 'bg-red-600';
                          case 'stopped':
                            return 'bg-slate-600';
                          case 'failed':
                            return 'bg-rose-600';
                          default:
                            return 'bg-slate-600';
                        }
                      };
                      
                      return (
                        <div
                          key={recording.id}
                          className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 p-3 hover:bg-slate-900 transition"
                        >
                          {/* File Info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Recording Icon */}
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-lg bg-red-600/20 flex items-center justify-center border border-red-600/30">
                                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                            
                            {/* Recording Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-white truncate">{fileName}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white flex-shrink-0 ${getStatusColor(recording.status)}`}>
                                  {recording.status.charAt(0).toUpperCase() + recording.status.slice(1)}
                                </span>
                                {recording.auto_stopped && (
                                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-600/20 text-yellow-300 border border-yellow-600/30 flex-shrink-0">
                                    Auto-stopped
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-400">
                                <span>By {recording.display_name}</span>
                                <span>•</span>
                                <span>{startedAt.toLocaleDateString()} {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {duration && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {durationMinutes !== null && durationSeconds !== null
                                        ? `${durationMinutes}m ${durationSeconds}s`
                                        : `${duration}s`}
                                    </span>
                                  </>
                                )}
                                {fileSizeMB && (
                                  <>
                                    <span>•</span>
                                    <span>{fileSizeMB} MB</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            {recording.url ? (
                              <button
                                onClick={() => handleRecordingDownload(recording.url!, recording.id, recording.meeting_id, recording.display_name, recording.started_at)}
                                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-blue-400"
                                title="Download Recording"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                            ) : recording.status === 'completed' ? (
                              <span className="text-xs text-slate-400 italic">Processing...</span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">In progress...</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="border-t border-slate-700 px-5 py-3">
                <div className="text-xs text-slate-400 text-center">
                  {recordings && recordings.length > 0 
                    ? `${recordings.length} recording${recordings.length === 1 ? '' : 's'}`
                    : 'No recordings'}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Transcript & Summary Modal */}
      {Array.from(expandedInsightsMeetings).map((meetingId) => {
        const items = meetingInsights.get(meetingId);
        const meeting = meetings.find(r => r.meeting.id === meetingId);
        return (
          <div key={meetingId}>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => toggleInsights(meetingId)}
            />
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-slate-950/80 backdrop-blur-md max-h-[85vh] flex flex-col transition-all duration-200 ease-out">
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Transcript & Summary</h2>
                  {meeting && (
                    <p className="text-sm text-slate-400 mt-1">
                      {meeting.meeting.title}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleInsights(meetingId)}
                  className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {!items || items.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-center text-slate-400">No transcripts or summaries available.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((it: any) => {
                      const startedAt = it.startedAt ? new Date(it.startedAt) : null;
                      const content = insightContentByRecording.get(it.recordingId);
                      const hasAny = it.hasTranscript || it.hasSummary;
                      return (
                        <div key={it.recordingId} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white truncate">
                                  Recording {it.recordingId.slice(0, 8)}...
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${hasAny ? 'bg-green-600' : 'bg-slate-600'}`}>
                                  {hasAny ? 'Available' : 'Unavailable'}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {startedAt ? `${startedAt.toLocaleDateString()} ${startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => openInsight(it.recordingId)}
                                className="rounded-md px-3 py-2 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                                disabled={!hasAny || content?.loading}
                              >
                                {content?.loading ? 'Opening...' : 'Open'}
                              </button>
                            </div>
                          </div>
                          {content && !content.loading && (content.transcriptText || content.summaryText || content.error) && (
                            <div className="mt-3 rounded-md border border-slate-700 bg-slate-900 p-4 max-h-[50vh] overflow-y-auto space-y-6">
                              {content.error ? (
                                <p className="text-sm text-rose-300">{content.error}</p>
                              ) : (
                                <>
                                  {content.transcriptText ? (
                                    <div className="space-y-3">
                                      <h3 className="text-sm font-semibold text-white">Transcript</h3>
                                      {renderTranscriptPretty(content.transcriptText)}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-300">Transcript not available.</p>
                                  )}
                                  {content.summaryText ? (
                                    <div className="pt-2 border-t border-slate-700">
                                      {renderSummaryPretty(content.summaryText)}
                                    </div>
                                  ) : (
                                    <div className="pt-2 border-t border-slate-700">
                                      <h3 className="text-sm font-semibold text-white">AI Summary</h3>
                                      <p className="text-slate-300 text-sm">No summary available.</p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-700 px-5 py-3">
                <div className="text-xs text-slate-400 text-center">
                  {items && items.length > 0 ? `${items.length} item${items.length === 1 ? '' : 's'}` : 'No items'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
}


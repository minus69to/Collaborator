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
                  key={record.meeting.id}
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
                    <div className="mt-4 flex items-center gap-2">
                      {isActive && (
                        <Link
                          href={`/meeting/${record.meeting.id}`}
                          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                        >
                          {isHost ? "Host Meeting" : "Join Again"}
                        </Link>
                      )}
                      <button
                        onClick={() => toggleChatHistory(record.meeting.id)}
                        className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
                        disabled={loadingChat.has(record.meeting.id)}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                        {loadingChat.has(record.meeting.id) ? (
                          "Loading..."
                        ) : (
                          "View Chat History"
                        )}
                      </button>
                      
                      <button
                        onClick={() => toggleFilesHistory(record.meeting.id)}
                        className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
                        disabled={loadingFiles.has(record.meeting.id)}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        {loadingFiles.has(record.meeting.id) ? (
                          "Loading..."
                        ) : (
                          "View Files"
                        )}
                      </button>
                      
                      <button
                        onClick={() => toggleRecordingsHistory(record.meeting.id)}
                        className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
                        disabled={loadingRecordings.has(record.meeting.id)}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        {loadingRecordings.has(record.meeting.id) ? (
                          "Loading..."
                        ) : (
                          "View Recordings"
                        )}
                      </button>
                    </div>
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => toggleChatHistory(meetingId)}
            />
            
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-slate-800 shadow-2xl border border-slate-700 max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
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
              <div className="border-t border-slate-700 px-6 py-3">
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => toggleFilesHistory(meetingId)}
            />
            
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-slate-800 shadow-2xl border border-slate-700 max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
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
              <div className="border-t border-slate-700 px-6 py-3">
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => toggleRecordingsHistory(meetingId)}
            />
            
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-slate-800 shadow-2xl border border-slate-700 max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
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
              <div className="border-t border-slate-700 px-6 py-3">
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
    </main>
  );
}


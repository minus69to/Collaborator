"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import {
  HMSRoomProvider,
  useHMSActions,
  useHMSStore,
  selectIsConnectedToRoom,
  selectPeers,
  selectLocalPeer,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
  useAVToggle,
  selectLocalVideoTrackID,
  selectLocalAudioTrackID,
  selectTracksMap,
} from "@100mslive/react-sdk";

// Component to render a single video tile
function VideoTile({ track, peer, localPeerId }: { track: any; peer: any; localPeerId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hmsActions = useHMSActions();
  const isLocal = peer?.id === localPeerId;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Try both HMS attachVideo and direct MediaStreamTrack attachment
    if (track) {
      console.log(`VideoTile: track found for ${peer?.name}`, {
        trackId: track.id,
        enabled: track.enabled,
        hasNativeTrack: !!track.nativeTrack,
        trackType: track.type,
        peerName: peer?.name,
        isLocal,
      });

      if (track.enabled) {
        // Try HMS attachVideo method
        try {
          hmsActions.attachVideo(track.id, videoElement);
          console.log(`Attached video via HMS attachVideo: ${track.id}`);
        } catch (err) {
          console.error("Failed HMS attachVideo:", err);
        }

        // Also try direct MediaStreamTrack attachment as fallback
        if (track.nativeTrack) {
          const stream = new MediaStream([track.nativeTrack]);
          videoElement.srcObject = stream;
          console.log(`Attached video via native track: ${track.id}`);
        }
      } else {
        // Track disabled - clear video
        videoElement.srcObject = null;
        try {
          hmsActions.detachVideo(track.id, videoElement);
        } catch (err) {
          // Ignore detach errors
        }
      }
    } else {
      console.log(`VideoTile: No track for ${peer?.name}`);
      videoElement.srcObject = null;
    }

    // Cleanup
    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
        if (track) {
          try {
            hmsActions.detachVideo(track.id, videoElement);
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      }
    };
  }, [track?.id, track?.enabled, track?.nativeTrack, peer?.name, isLocal, hmsActions]);

  // Always render video element (even if track not ready), so we can attach when available
  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${!track || !track.enabled ? "hidden" : ""}`}
      />
      {(!track || !track.enabled) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="mb-2 text-4xl">👤</div>
            <p className="text-sm text-slate-400">{peer?.name || "Unknown"}</p>
            {isLocal && <p className="mt-1 text-xs text-slate-500">(You)</p>}
            <p className="mt-1 text-xs text-slate-500">
              {peer?.audioTrack?.enabled ? "🎤" : "🔇"}
            </p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs z-10">
        {peer?.name || "Unknown"}
        {isLocal && " (You)"}
        <span className="ml-1">{peer?.audioTrack?.enabled ? "🎤" : "🔇"}</span>
      </div>
    </>
  );
}

function MeetingRoom() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { user } = useUser();
  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const localPeer = useHMSStore(selectLocalPeer);
  const isAudioEnabled = useHMSStore(selectIsLocalAudioEnabled);
  const isVideoEnabled = useHMSStore(selectIsLocalVideoEnabled);
  const tracksMap = useHMSStore(selectTracksMap);
  const localVideoTrackID = useHMSStore(selectLocalVideoTrackID);
  const localAudioTrackID = useHMSStore(selectLocalAudioTrackID);
  
  // Debug: Log peers and tracks
  useEffect(() => {
    console.log("Peers updated:", peers.length, "peers");
    console.log("Tracks map size:", Object.keys(tracksMap || {}).length);
    peers.forEach((peer) => {
      const videoTrack = peer.videoTrack;
      const audioTrack = peer.audioTrack;
      const hasVideo = !!videoTrack;
      const hasAudio = !!audioTrack;
      
      console.log(`Peer: ${peer.name}`, {
        id: peer.id,
        hasVideoTrack: hasVideo,
        hasAudioTrack: hasAudio,
        videoTrackType: typeof videoTrack,
        videoTrackKeys: videoTrack ? Object.keys(videoTrack) : null,
        videoTrackId: videoTrack?.id,
        videoTrackEnabled: videoTrack?.enabled,
        videoTrackNativeTrack: !!videoTrack?.nativeTrack,
        audioTrackEnabled: audioTrack?.enabled,
        isLocal: peer.id === localPeer?.id,
      });
      
      // Log the actual track object structure
      if (videoTrack) {
        console.log(`VideoTrack object for ${peer.name}:`, videoTrack);
      }
    });
  }, [peers, localPeer, isConnected, tracksMap]);
  
  // Toggle audio/video - use direct HMS actions as fallback
  const avToggle = useAVToggle();
  const [toggleError, setToggleError] = useState<string | null>(null);
  
  const handleToggleAudio = async () => {
    setToggleError(null);
    try {
      console.log("Toggle audio clicked", {
        isAudioEnabled,
        localPeerId: localPeer?.id,
        localPeerRole: localPeer?.role?.name,
        hasAVToggle: !!avToggle?.toggleAudio,
      });

      if (avToggle?.toggleAudio) {
        console.log("Using avToggle.toggleAudio()");
        await avToggle.toggleAudio();
      } else {
        // Fallback: setEnabledTrack(trackType, enabled)
        console.log("Using hmsActions.setEnabledTrack('audio',", !isAudioEnabled, ")");
        await hmsActions.setEnabledTrack("audio", !isAudioEnabled);
      }
      
      console.log("Audio toggle successful");
      
      // Verify the change after a short delay
      setTimeout(() => {
        console.log("Audio state after toggle:", {
          wasEnabled: isAudioEnabled,
          nowEnabled: !isAudioEnabled,
        });
      }, 500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to toggle audio";
      console.error("Failed to toggle audio:", err);
      setToggleError(errorMsg);
      // Clear error after 3 seconds
      setTimeout(() => setToggleError(null), 3000);
    }
  };

  const handleToggleVideo = async () => {
    setToggleError(null);
    try {
      console.log("Toggle video clicked", {
        isVideoEnabled,
        localPeerId: localPeer?.id,
        localPeerRole: localPeer?.role?.name,
        hasAVToggle: !!avToggle?.toggleVideo,
      });

      if (avToggle?.toggleVideo) {
        console.log("Using avToggle.toggleVideo()");
        await avToggle.toggleVideo();
      } else {
        // Fallback: setEnabledTrack(trackType, enabled)
        console.log("Using hmsActions.setEnabledTrack('video',", !isVideoEnabled, ")");
        await hmsActions.setEnabledTrack("video", !isVideoEnabled);
      }
      
      console.log("Video toggle successful");
      
      // Verify the change after a short delay
      setTimeout(() => {
        console.log("Video state after toggle:", {
          wasEnabled: isVideoEnabled,
          nowEnabled: !isVideoEnabled,
        });
      }, 500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to toggle video";
      console.error("Failed to toggle video:", err);
      setToggleError(errorMsg);
      // Clear error after 3 seconds
      setTimeout(() => setToggleError(null), 3000);
    }
  };

  const [meeting, setMeeting] = useState<{ id: string; title: string; description?: string | null; hms_room_id?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function fetchMeeting() {
      try {
        const response = await fetch(`/api/meetings/get?meetingId=${meetingId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch meeting");
        }
        const payload = await response.json();
        setMeeting(payload.meeting);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId]);

  async function handleJoin() {
    if (!meeting?.hms_room_id || !user) return;

    setJoining(true);
    setError(null);
    try {
      // Get token from our API - use "broadcaster" role (matches your template)
      const tokenResponse = await fetch("/api/100ms-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: meeting.hms_room_id,
          role: "broadcaster", // Matches your 100ms template role
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || "Failed to get token");
      }

      const { token } = await tokenResponse.json();

      if (!token) {
        throw new Error("No token received from server");
      }

      // Join the 100ms room
      await hmsActions.join({
        userName: user.email || "User",
        authToken: token,
      });

      // Tracks will be enabled in the useEffect when isConnected becomes true
      // If join succeeds, setJoining(false) will be handled by isConnected state change
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to join meeting";
      console.error("Join error:", err);
      setError(errorMsg);
      setJoining(false);
    }
  }

  // Enable tracks when connected
  useEffect(() => {
    if (isConnected && hmsActions) {
      // Enable audio and video after connection
      const enableTracks = async () => {
        try {
          console.log("Enabling tracks after join...");
          console.log("Local peer state:", {
            hasAudioTrack: !!localPeer?.audioTrack,
            hasVideoTrack: !!localPeer?.videoTrack,
            audioEnabled: isAudioEnabled,
            videoEnabled: isVideoEnabled,
          });
          
          // Try enabling audio first
          try {
            console.log("Attempting to enable audio track...");
            await hmsActions.setEnabledTrack("audio", true);
            console.log("Audio track enabled successfully");
          } catch (audioErr) {
            console.error("Failed to enable audio:", audioErr);
          }
          
          // Then enable video
          try {
            console.log("Attempting to enable video track...");
            await hmsActions.setEnabledTrack("video", true);
            console.log("Video track enabled successfully");
          } catch (videoErr) {
            console.error("Failed to enable video:", videoErr);
          }
          
          // Check again after a delay
          setTimeout(() => {
            console.log("Tracks state after enabling:", {
              hasAudioTrack: !!localPeer?.audioTrack,
              hasVideoTrack: !!localPeer?.videoTrack,
            });
          }, 2000);
        } catch (err) {
          console.error("Failed to enable tracks:", err);
        }
      };
      
      // Wait a bit for the room to be fully initialized
      const timeout = setTimeout(enableTracks, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isConnected, hmsActions, localPeer, isAudioEnabled, isVideoEnabled]);

  // Reset joining state when connected
  useEffect(() => {
    if (isConnected) {
      setJoining(false);
      setError(null);
    }
  }, [isConnected]);

  async function handleLeave() {
    await hmsActions.leave();
    router.push("/meetings");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p>Loading meeting...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <p className="text-rose-300">{error || "Meeting not found"}</p>
          <button
            onClick={() => router.push("/meetings")}
            className="mt-4 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Meetings
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-8">
          <h1 className="text-2xl font-semibold">{meeting.title}</h1>
          {meeting.description && <p className="text-sm text-slate-300">{meeting.description}</p>}
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"
          >
            {joining ? "Joining..." : "Join Meeting"}
          </button>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{meeting.title}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {peers.length} participant{peers.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={handleLeave}
              className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              Leave Meeting
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-6">
        <div className="mx-auto h-full max-w-7xl">
          {/* Video Grid */}
          <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {peers.map((peer) => {
              // peer.videoTrack is a STRING (track ID), not the track object!
              // We need to look it up in the tracks map
              let videoTrack: any = null;
              
              // Check if peer.videoTrack is a string (track ID) or an object
              const videoTrackRef = peer.videoTrack;
              
              if (videoTrackRef) {
                if (typeof videoTrackRef === "string") {
                  // It's a track ID string - look it up in tracks map
                  videoTrack = tracksMap?.[videoTrackRef];
                  if (videoTrack) {
                    console.log(`Found video track by ID for ${peer.name}:`, videoTrack);
                  } else {
                    console.warn(`Track ID ${videoTrackRef} not found in tracks map for ${peer.name}`);
                  }
                } else {
                  // It's already a track object
                  videoTrack = videoTrackRef;
                }
              }
              
              // Fallback: Try localVideoTrackID for local peer
              if (!videoTrack && peer.id === localPeer?.id && localVideoTrackID) {
                videoTrack = tracksMap?.[localVideoTrackID];
                if (videoTrack) {
                  console.log(`Found local video track by localVideoTrackID for ${peer.name}:`, videoTrack);
                }
              }
              
              // Fallback: Search all tracks for this peer
              if (!videoTrack && tracksMap) {
                const allTracks = Object.values(tracksMap);
                const peerTracks = allTracks.filter((track: any) => {
                  // Check if track belongs to this peer
                  return (track.peerId === peer.id || track.peer?.id === peer.id) && track.type === "video";
                });
                if (peerTracks.length > 0) {
                  videoTrack = peerTracks[0] as any;
                  console.log(`Found video track by peer search for ${peer.name}:`, videoTrack);
                }
              }
              
              return (
                <div
                  key={peer.id}
                  className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
                >
                  <VideoTile track={videoTrack} peer={peer} localPeerId={localPeer?.id} />
                </div>
              );
            })}
            {peers.length === 0 && (
              <div className="col-span-full flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 text-6xl">👥</div>
                  <p className="text-slate-400">Waiting for participants...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {/* Controls Bar */}
      <footer className="border-t border-slate-800 bg-slate-900/70 p-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4">
          {toggleError && (
            <div className="rounded-md bg-rose-500/20 px-4 py-2 text-sm text-rose-300">
              Error: {toggleError}
            </div>
          )}
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleAudio}
              disabled={!isConnected || !localPeer}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isAudioEnabled
                  ? "bg-slate-700 text-white hover:bg-slate-600"
                  : "bg-rose-500 text-white hover:bg-rose-400"
              }`}
            >
              {isAudioEnabled ? "🎤" : "🔇"} {isAudioEnabled ? "Mute" : "Unmute"}
            </button>
            <button
              onClick={handleToggleVideo}
              disabled={!isConnected || !localPeer}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isVideoEnabled
                  ? "bg-slate-700 text-white hover:bg-slate-600"
                  : "bg-rose-500 text-white hover:bg-rose-400"
              }`}
            >
              {isVideoEnabled ? "📹" : "📵"} {isVideoEnabled ? "Stop Video" : "Start Video"}
            </button>
          </div>
          {localPeer && (
            <div className="text-xs text-slate-500">
              Role: {localPeer.role?.name || "unknown"} | Peer ID: {localPeer.id}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function MeetingPage() {
  return (
    <HMSRoomProvider>
      <MeetingRoom />
    </HMSRoomProvider>
  );
}


"use client";

import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";
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

// Component to render a single video tile
function VideoTile({
  track,
  peer,
  localPeerId,
  isHost,
  audioTrack,
}: {
  track: any;
  peer: any;
  localPeerId?: string;
  isHost?: boolean;
  audioTrack?: any;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hmsActions = useHMSActions();
  const isLocal = peer?.id === localPeerId;
  
  // Get audio track enabled status
  const isAudioEnabled = audioTrack?.enabled ?? false;
  const isVideoEnabled = track?.enabled ?? false;
  
  const peerName = peer?.name || "Unknown";
  const initials = getInitials(peerName);
  const avatarColor = getAvatarColor(peerName);

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
      
      {/* Avatar/Placeholder when video is off */}
      {(!track || !track.enabled) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="flex flex-col items-center justify-center">
            {/* Avatar Circle */}
            <div className={`${avatarColor} mb-3 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-lg`}>
              {initials}
            </div>
            <p className="text-sm font-medium text-slate-200">{peerName}</p>
            {isLocal && (
              <p className="mt-1 text-xs text-slate-400">(You)</p>
            )}
          </div>
        </div>
      )}

      {/* Bottom overlay with name, host badge, and status icons */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-3 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Name */}
            <span className="text-sm font-medium text-white truncate max-w-[200px]">
              {peerName}
            </span>
            {/* Host Badge */}
            {isHost && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-500/90 px-2 py-0.5 text-xs font-semibold text-black">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Host
              </span>
            )}
            {/* Local badge */}
            {isLocal && !isHost && (
              <span className="text-xs text-slate-300">(You)</span>
            )}
          </div>
          
          {/* Status Icons */}
          <div className="flex items-center gap-2">
            {/* Mic Icon */}
            <div className={`flex items-center justify-center rounded-full p-1.5 ${
              isAudioEnabled 
                ? "bg-green-500/20 text-green-400" 
                : "bg-red-500/20 text-red-400"
            }`}>
              {isAudioEnabled ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            
            {/* Camera Icon */}
            <div className={`flex items-center justify-center rounded-full p-1.5 ${
              isVideoEnabled 
                ? "bg-green-500/20 text-green-400" 
                : "bg-red-500/20 text-red-400"
            }`}>
              {isVideoEnabled ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              )}
            </div>
          </div>
        </div>
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

  const [meeting, setMeeting] = useState<{ 
    id: string; 
    title: string; 
    description?: string | null; 
    hms_room_id?: string | null;
    host_id?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [displayName, setDisplayName] = useState("");

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

  async function handleJoin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    
    if (!meeting?.hms_room_id || !user) return;

    // Validate display name
    if (!displayName.trim()) {
      setError("Please enter your name to join the meeting");
      return;
    }

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

      // Join the 100ms room with the display name
      await hmsActions.join({
        userName: displayName.trim(),
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

  // Set default display name from user email if not set
  useEffect(() => {
    if (user?.email && !displayName && !isConnected) {
      // Extract name from email (part before @) or use email as fallback
      const emailName = user.email.split("@")[0];
      setDisplayName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
    }
  }, [user?.email, displayName, isConnected]);

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
          <div className="text-center">
            <h1 className="text-2xl font-semibold">{meeting.title}</h1>
            {meeting.description && (
              <p className="mt-2 text-sm text-slate-300">{meeting.description}</p>
            )}
          </div>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-slate-200 mb-2">
                Your Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600"
                disabled={joining}
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-400">
                This name will be displayed in the meeting
              </p>
            </div>
            
            <button
              type="submit"
              disabled={joining || !displayName.trim()}
              className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? "Joining..." : "Join Meeting"}
            </button>
            
            {error && <p className="text-sm text-rose-300 text-center">{error}</p>}
          </form>
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
              let audioTrack: any = null;
              
              // Check if peer.videoTrack is a string (track ID) or an object
              const videoTrackRef = peer.videoTrack;
              const audioTrackRef = peer.audioTrack;
              
              // Get video track
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
              
              // Get audio track
              if (audioTrackRef) {
                if (typeof audioTrackRef === "string") {
                  // It's a track ID string - look it up in tracks map
                  audioTrack = tracksMap?.[audioTrackRef];
                } else {
                  // It's already a track object
                  audioTrack = audioTrackRef;
                }
              }
              
              // Fallback: Try localAudioTrackID for local peer
              if (!audioTrack && peer.id === localPeer?.id && localAudioTrackID) {
                audioTrack = tracksMap?.[localAudioTrackID];
              }
              
              // Fallback: Search all tracks for this peer
              if (!audioTrack && tracksMap) {
                const allTracks = Object.values(tracksMap);
                const peerTracks = allTracks.filter((track: any) => {
                  // Check if track belongs to this peer
                  return (track.peerId === peer.id || track.peer?.id === peer.id) && track.type === "audio";
                });
                if (peerTracks.length > 0) {
                  audioTrack = peerTracks[0] as any;
                }
              }
              
              // Check if this peer is the host
              // For local peer: compare user ID with meeting host_id
              const isLocalHost = peer.id === localPeer?.id && user?.id === meeting.host_id;
              
              // For remote peers: we can't reliably determine host status from HMS alone
              // But we can show host badge for local peer when they are the host
              // Note: To properly show host status for all peers, we'd need to store/compare Supabase user IDs
              const isHost = isLocalHost;
              
              return (
                <div
                  key={peer.id}
                  className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-lg"
                >
                  <VideoTile 
                    track={videoTrack} 
                    peer={peer} 
                    localPeerId={localPeer?.id}
                    isHost={isHost}
                    audioTrack={audioTrack}
                  />
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


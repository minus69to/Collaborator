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
  isLocalHost,
  audioTrack,
  onToggleAudio,
  onToggleVideo,
  onToggleRemoteAudio,
  onToggleRemoteVideo,
  isHandRaised,
}: {
  track: any;
  peer: any;
  localPeerId?: string;
  isHost?: boolean;
  isLocalHost?: boolean;
  audioTrack?: any;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  onToggleRemoteAudio?: (peerId: string, enabled: boolean) => void;
  onToggleRemoteVideo?: (peerId: string, enabled: boolean) => void;
  isHandRaised?: boolean;
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
      {/* Top Left: Raised Hand Icon (if raised) - positioned relative to video tile */}
      {isHandRaised && (
        <div className="absolute top-2 left-2 z-20 bg-yellow-500 rounded-full p-2 shadow-lg animate-bounce">
          <svg className="h-6 w-6 text-black" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/>
          </svg>
        </div>
      )}
      
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
            <div className={`${avatarColor} mb-2 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-lg`}>
              {initials}
            </div>
            {isLocal && (
              <p className="mt-0.5 text-xs text-slate-300">(You)</p>
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
          
          {/* Status Icons Row - Bottom Overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end bg-gradient-to-t from-black/80 to-transparent p-3">
            {/* Right Side: Mic and Camera Icons */}
            <div className="flex items-center gap-2">
              {/* Mic Icon - Clickable for local user or host */}
              {(isLocal || (isLocalHost && !isLocal)) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent tile maximize on button click
                    if (isLocal && onToggleAudio) {
                      onToggleAudio();
                    } else if (isLocalHost && !isLocal && onToggleRemoteAudio) {
                      onToggleRemoteAudio(peer.id, !isAudioEnabled);
                    }
                  }}
                  className={`flex items-center justify-center rounded-full p-1.5 transition hover:opacity-80 active:scale-95 ${
                    isAudioEnabled 
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" 
                      : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  }`}
                  title={
                    isLocal 
                      ? (isAudioEnabled ? "Mute microphone" : "Unmute microphone")
                      : (isAudioEnabled ? `Mute ${peerName}'s microphone` : `Unmute ${peerName}'s microphone`)
                  }
                >
                  {isAudioEnabled ? (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ) : (
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
              )}
              
              {/* Camera Icon - Clickable for local user or host */}
              {(isLocal || (isLocalHost && !isLocal)) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent tile maximize on button click
                    if (isLocal && onToggleVideo) {
                      onToggleVideo();
                    } else if (isLocalHost && !isLocal && onToggleRemoteVideo) {
                      onToggleRemoteVideo(peer.id, !isVideoEnabled);
                    }
                  }}
                  className={`flex items-center justify-center rounded-full p-1.5 transition hover:opacity-80 active:scale-95 ${
                    isVideoEnabled 
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" 
                      : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  }`}
                  title={
                    isLocal 
                      ? (isVideoEnabled ? "Turn off camera" : "Turn on camera")
                      : (isVideoEnabled ? `Turn off ${peerName}'s camera` : `Turn on ${peerName}'s camera`)
                  }
                >
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
                </button>
              ) : (
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
  
  // Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  
  // Suppress non-critical HMS SDK reconnection errors
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Intercept console.error to filter HMS reconnection errors
    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ').toLowerCase();
      const isHMSReconnectionError = errorMessage.includes('hms-store') && 
                                     errorMessage.includes('reconnection') &&
                                     errorMessage.includes('received error from sdk');
      
      if (isHMSReconnectionError) {
        // Suppress non-critical reconnection errors - they're often harmless
        console.debug('[HMS SDK] Reconnection error (suppressed):', ...args);
        return;
      }
      
      // Pass through all other errors
      originalError.apply(console, args);
    };
    
    // Intercept console.warn for HMS reconnection warnings
    console.warn = (...args: any[]) => {
      const warnMessage = args.join(' ').toLowerCase();
      const isHMSReconnectionWarning = warnMessage.includes('hms') && 
                                        warnMessage.includes('reconnection');
      
      if (isHMSReconnectionWarning) {
        // Suppress non-critical reconnection warnings
        console.debug('[HMS SDK] Reconnection warning (suppressed):', ...args);
        return;
      }
      
      // Pass through all other warnings
      originalWarn.apply(console, args);
    };
    
    return () => {
      // Restore original console methods on cleanup
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);
  
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

  // Screen sharing handlers
  const handleStartScreenShare = async () => {
    setScreenShareError(null);
    
    // Prevent multiple simultaneous attempts
    if (isScreenSharing) {
      return;
    }
    
    try {
      console.log("Starting screen share...");
      
      // Check if connected to room
      if (!isConnected) {
        throw new Error("Not connected to the meeting. Please wait...");
      }
      
      // Check if screen sharing is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen sharing is not supported in this browser");
      }
      
      // Start screen sharing using HMS with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Screen share request timed out")), 10000)
      );
      
      await Promise.race([
        hmsActions.setScreenShareEnabled(true),
        timeoutPromise
      ]);
      
      // Don't set state immediately - let the useEffect monitor handle it
      console.log("Screen share started successfully");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to start screen sharing";
      
      // Filter out non-critical reconnection errors
      const isReconnectionError = errorMsg.toLowerCase().includes("reconnection") || 
                                  errorMsg.toLowerCase().includes("reconnect");
      
      if (!isReconnectionError) {
        console.error("Failed to start screen share:", err);
        setScreenShareError(errorMsg);
        setIsScreenSharing(false);
        // Clear error after 5 seconds
        setTimeout(() => setScreenShareError(null), 5000);
      } else {
        // Reconnection errors are often non-critical - just log them
        console.warn("Screen share reconnection warning (non-critical):", errorMsg);
      }
    }
  };

  const handleStopScreenShare = async () => {
    setScreenShareError(null);
    
    // Prevent multiple simultaneous attempts
    if (!isScreenSharing) {
      return;
    }
    
    try {
      console.log("Stopping screen share...");
      
      // Check if connected to room
      if (!isConnected) {
        // If not connected, just update local state
        setIsScreenSharing(false);
        return;
      }
      
      // Stop screen sharing using HMS with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Stop screen share request timed out")), 10000)
      );
      
      await Promise.race([
        hmsActions.setScreenShareEnabled(false),
        timeoutPromise
      ]);
      
      // Update state immediately since we're stopping
      setIsScreenSharing(false);
      console.log("Screen share stopped successfully");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to stop screen sharing";
      
      // Filter out non-critical reconnection errors
      const isReconnectionError = errorMsg.toLowerCase().includes("reconnection") || 
                                  errorMsg.toLowerCase().includes("reconnect");
      
      if (!isReconnectionError) {
        console.error("Failed to stop screen share:", err);
        setScreenShareError(errorMsg);
        // Clear error after 5 seconds
        setTimeout(() => setScreenShareError(null), 5000);
      } else {
        // Reconnection errors are often non-critical - just update state and log
        console.warn("Screen share stop reconnection warning (non-critical):", errorMsg);
        setIsScreenSharing(false);
      }
    }
  };

  // Monitor screen share state from HMS
  useEffect(() => {
    if (!isConnected || !localPeer) return;
    
    // Check if local peer has screen share track
    const checkScreenShare = () => {
      const allTracks = Object.values(tracksMap || {});
      const screenShareTrack = allTracks.find((track: any) => 
        track.peerId === localPeer.id && 
        track.type === "video" && 
        track.source === "screen"
      );
      
      const hasScreenShare = !!screenShareTrack;
      if (hasScreenShare !== isScreenSharing) {
        setIsScreenSharing(hasScreenShare);
      }
    };
    
    checkScreenShare();
    
    // Check periodically in case HMS state changes
    const interval = setInterval(checkScreenShare, 1000);
    return () => clearInterval(interval);
  }, [isConnected, localPeer, tracksMap, isScreenSharing]);

  const [meeting, setMeeting] = useState<{ 
    id: string; 
    title: string; 
    description?: string | null; 
    hms_room_id?: string | null;
    host_id?: string;
    host_email?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [hostDisplayName, setHostDisplayName] = useState<string | null>(null);
  const [activeParticipantNames, setActiveParticipantNames] = useState<Set<string>>(new Set());
  const [participantNameToUserId, setParticipantNameToUserId] = useState<Map<string, string>>(new Map());
  const [userIdToDisplayName, setUserIdToDisplayName] = useState<Map<string, string>>(new Map());
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Map<string, boolean>>(new Map()); // peer.id -> isRaised
  const [participantsWithEmails, setParticipantsWithEmails] = useState<any[]>([]); // Store participants with emails
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatMessageInput, setChatMessageInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  
  // Files state
  const [showFiles, setShowFiles] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const [allowParticipantsToRecord, setAllowParticipantsToRecord] = useState(false);
  const [activeRecording, setActiveRecording] = useState<any>(null);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const [isTogglingPermission, setIsTogglingPermission] = useState(false);
  
  // Meeting duration (stopwatch-style)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Video tile maximization state
  const [maximizedPeerId, setMaximizedPeerId] = useState<string | null>(null);

  // Start/stop meeting timer based on connection state
  useEffect(() => {
    if (!isConnected) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const formatElapsed = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
  };
  
  // Clear maximized state if the maximized peer leaves
  useEffect(() => {
    if (maximizedPeerId) {
      const isScreenShare = maximizedPeerId.endsWith('-screen');
      const actualPeerId = isScreenShare 
        ? maximizedPeerId.replace('-screen', '') 
        : maximizedPeerId;
      
      // Check if peer still exists
      const peerExists = peers.find(p => p.id === actualPeerId);
      
      // If it's a screen share, also check if the screen share track still exists
      if (isScreenShare) {
        const allTracks = Object.values(tracksMap || {});
        const screenTracks = allTracks.filter((track: any) => {
          return (track.peerId === actualPeerId || track.peer?.id === actualPeerId) && 
                 track.type === "video" && 
                 track.source === "screen";
        });
        
        if (!peerExists || screenTracks.length === 0) {
          // Peer left or stopped screen sharing, restore normal view
          setMaximizedPeerId(null);
        }
      } else {
        if (!peerExists) {
          // Peer left, restore normal view
          setMaximizedPeerId(null);
        }
      }
    }
  }, [maximizedPeerId, peers, tracksMap]);
  
  // Toggle maximized state for a peer
  const handleToggleMaximize = (peerId: string, isScreenShare = false) => {
    // Create unique key: "peer-id" for video, "peer-id-screen" for screen share
    const uniqueKey = isScreenShare ? `${peerId}-screen` : peerId;
    
    if (maximizedPeerId === uniqueKey) {
      // If clicking the already maximized tile, restore normal view
      setMaximizedPeerId(null);
    } else {
      // Maximize the clicked tile
      setMaximizedPeerId(uniqueKey);
    }
  };
  
  // Calculate optimal grid columns based on participant count
  const getOptimalGridCols = (count: number): number => {
    if (count === 0) return 1;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    if (count <= 9) return 3;
    if (count <= 12) return 4;
    if (count <= 16) return 4;
    if (count <= 20) return 5;
    return 6; // Max 6 columns
  };

  useEffect(() => {
    async function fetchMeeting() {
      try {
        const response = await fetch(`/api/meetings/get?meetingId=${meetingId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch meeting");
        }
        const payload = await response.json();
        setMeeting(payload.meeting);
        // Check if current user is the host
        if (user && payload.meeting.host_id === user.id) {
          setIsHost(true);
        }

        // Check if user is already an active participant
        if (user) {
          const participantCheck = await fetch(
            `/api/meetings/check-participant?meetingId=${meetingId}`
          );
          if (participantCheck.ok) {
            const participantData = await participantCheck.json();
            if (participantData.isActiveParticipant && participantData.participant) {
              // User is already an active participant
              // Set their display name from existing record
              const existingDisplayName = participantData.participant.display_name || "";
              setDisplayName(existingDisplayName);
              // If host, set host display name
              if (participantData.participant.role === "host") {
                setHostDisplayName(existingDisplayName);
              }
              
              // Check if there's an existing connection (page refresh case)
              // Note: On refresh, HMS SDK connection is lost, so we need to rejoin
              // But we preserve the participant record so user doesn't count twice
              console.log("User is already an active participant, can rejoin without creating new record");
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    if (meetingId && user) {
      fetchMeeting();
    }
  }, [meetingId, user]);

  async function handleJoin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    
    if (!meeting?.hms_room_id || !user) return;

    // Validate display name
    if (!displayName.trim()) {
      setError("Please enter your name to join the meeting");
      return;
    }

    // Check if already connected to avoid duplicate joins
    if (isConnected) {
      setError("You are already in this meeting");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      // Immediately terminate previous join if exists
      // This ensures the previous participant record is ended before creating a new one
      const participantCheck = await fetch(
        `/api/meetings/check-participant?meetingId=${meeting.id}`
      );
      if (participantCheck.ok) {
        const participantData = await participantCheck.json();
        if (participantData.isActiveParticipant) {
          // User has an active participant record - terminate it immediately and WAIT for it to complete
          console.log("Terminating previous participant record before new join");
          try {
            const leaveResponse = await fetch("/api/meetings/leave", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                meetingId: meeting.id,
              }),
            });
            
            if (!leaveResponse.ok) {
              console.error("Failed to terminate previous participant record");
            } else {
              console.log("Previous participant record terminated successfully");
              // Wait a bit to ensure database update is complete
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Signal other tabs to leave via localStorage
            const leaveSignalKey = `hms_leave_${meeting.id}_${user.id}`;
            localStorage.setItem(leaveSignalKey, Date.now().toString());
            // Remove signal after a short delay
            setTimeout(() => {
              localStorage.removeItem(leaveSignalKey);
            }, 1000);
          } catch (err) {
            console.error("Error terminating previous participant:", err);
            // Continue anyway - the participants API will handle it as fallback
          }
        }
      }

      // Check if user is host - if yes, join directly
      if (isHost) {
        await joinMeeting(displayName.trim(), "host");
        return;
      }

      // If not host, create join request
      const requestResponse = await fetch("/api/meetings/join-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          displayName: displayName.trim(),
        }),
      });

      if (!requestResponse.ok) {
        const errorData = await requestResponse.json();
        throw new Error(errorData.error || "Failed to create join request");
      }

      const requestData = await requestResponse.json();

      if (requestData.approved && requestData.canJoin) {
        // Already approved, join directly
        await joinMeeting(displayName.trim(), "participant");
      } else {
        // Waiting for approval - the useEffect will automatically start polling
        setIsWaitingForApproval(true);
        setRequestId(requestData.requestId);
        setJoining(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to join meeting";
      console.error("Join error:", err);
      setError(errorMsg);
      setJoining(false);
    }
  }

  // Join HMS room only (without creating participant record)
  async function joinHMSRoom(name: string) {
    if (!meeting?.hms_room_id) return;

    // Declare storageKey once at the beginning
    const storageKey = `hms_connected_${meeting.id}_${user?.id}`;

    try {
      // Check if already connected before joining
      if (isConnected) {
        console.log("Already connected to HMS room, skipping join");
        return;
      }

      // Check localStorage to prevent duplicate joins from multiple tabs
      // Use timestamp to allow rejoin after 5 seconds (in case tab crashed)
      const existingConnection = localStorage.getItem(storageKey);
      if (existingConnection) {
        const connectionTime = parseInt(existingConnection, 10);
        const now = Date.now();
        const timeSinceConnection = now - connectionTime;
        
        // If connection is less than 5 seconds old, prevent duplicate join
        // Shorter window to allow refresh to work better
        if (timeSinceConnection < 5000) {
          // Another tab might be connected - end previous participant record first
          try {
            await fetch("/api/meetings/leave", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                meetingId: meeting.id,
              }),
            });
            // Clear old connection marker
            localStorage.removeItem(storageKey);
          } catch (err) {
            console.error("Error ending previous participant record:", err);
          }
          // Continue with join - previous record will be ended
        } else {
          // Old connection (tab might have crashed) - allow rejoin
          localStorage.removeItem(storageKey);
        }
      }

      // Get token from our API
      const tokenResponse = await fetch("/api/100ms-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: meeting.hms_room_id,
          role: "broadcaster",
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

      // Mark as connecting in localStorage with timestamp
      localStorage.setItem(storageKey, Date.now().toString());

      // Join the 100ms room with the display name
      await hmsActions.join({
        userName: name,
        authToken: token,
      });
    } catch (err) {
      // Clear storage on error
      localStorage.removeItem(storageKey);
      throw err;
    }
  }

  async function joinMeeting(name: string, role: "host" | "participant") {
    if (!meeting?.hms_room_id) return;

    try {
      // First check if already connected
      if (isConnected) {
        console.log("Already connected to HMS room");
        // Still update participant record if needed
        await recordParticipant(name, role);
        return;
      }

      // Join HMS room
      await joinHMSRoom(name);

      // Record participant - wait for it to complete to ensure it's saved
      await recordParticipant(name, role);
    } catch (err) {
      throw err;
    }
  }

  async function recordParticipant(name: string, role: "host" | "participant") {
    try {
      const participantResponse = await fetch("/api/meetings/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting?.id,
          role,
          displayName: name,
        }),
      });

      if (!participantResponse.ok) {
        const errorData = await participantResponse.json();
        console.error("Failed to record participant:", errorData.error);
        // Don't throw - we're already in the meeting, just log the error
      } else {
        // If host joined, store their display name for identification
        if (role === "host") {
          setHostDisplayName(name);
        }
      }
    } catch (err) {
      console.error("Error recording participant:", err);
      // Don't throw - we're already in the meeting
    }
  }

  // Poll for approval when waiting
  useEffect(() => {
    if (!isWaitingForApproval || !requestId || !meeting?.id || isConnected) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        // Check join request status
        const checkResponse = await fetch("/api/meetings/join-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId: meeting.id,
            displayName: displayName.trim(),
          }),
        });

        if (checkResponse.ok) {
          const data = await checkResponse.json();
          
          if (data.approved && data.canJoin) {
            clearInterval(interval);
            setIsWaitingForApproval(false);
            setJoining(true);
            await joinMeeting(displayName.trim(), "participant");
          }
        }
      } catch (err) {
        console.error("Error polling for approval:", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [isWaitingForApproval, requestId, meeting?.id, displayName, isConnected]);

  // Poll for pending requests when host is connected
  useEffect(() => {
    if (!isHost || !isConnected || !meeting?.id) {
      return;
    }

    const fetchPendingRequests = async () => {
      try {
        const response = await fetch(`/api/meetings/pending-requests?meetingId=${meeting.id}`);
        if (response.ok) {
          const data = await response.json();
          setPendingRequests(data.requests || []);
        }
      } catch (err) {
        console.error("Error fetching pending requests:", err);
      }
    };

    // Fetch immediately
    fetchPendingRequests();

    // Poll every 3 seconds
    const interval = setInterval(fetchPendingRequests, 3000);

    return () => clearInterval(interval);
  }, [isHost, isConnected, meeting?.id]);

  // Fetch host display name and active participant names from participant records when connected
  useEffect(() => {
    if (isConnected && meeting?.id) {
      const fetchParticipantInfo = async () => {
        try {
          // Get all active participants
          const response = await fetch(`/api/meetings/participants?meetingId=${meeting.id}`);
          if (response.ok) {
            const data = await response.json();
            const participants = data.participants || [];
            
            // Set active participant names for filtering
            const names = new Set(participants.map((p: any) => p.display_name).filter(Boolean));
            setActiveParticipantNames(names);
            
            // Build mapping: display_name -> user_id (for current active participants)
            // Also build mapping: user_id -> display_name (current display name for each user)
            // IMPORTANT: Only one active participant per user_id, so each user_id maps to their current name
            const nameToUserIdMap = new Map<string, string>();
            const userIdToNameMap = new Map<string, string>();
            
            participants.forEach((p: any) => {
              if (p.display_name && p.user_id) {
                // Current active participant: this is the user's current display name
                nameToUserIdMap.set(p.display_name, p.user_id);
                userIdToNameMap.set(p.user_id, p.display_name);
              }
            });
            
            setParticipantNameToUserId(nameToUserIdMap);
            setUserIdToDisplayName(userIdToNameMap);
            
            // Store participants with emails for the participants list
            setParticipantsWithEmails(participants);
            
            // Get host display name - ALWAYS update (not just when !hostDisplayName) to ensure it's current
            if (meeting.host_id) {
              const hostParticipant = participants.find((p: any) => 
                p.user_id === meeting.host_id && p.role === "host"
              );
              if (hostParticipant?.display_name) {
                setHostDisplayName(hostParticipant.display_name);
              }
            }
          }
        } catch (err) {
          console.error("Error fetching participant info:", err);
        }
      };
      
      // Fetch immediately
      fetchParticipantInfo();
      
      // Then fetch periodically
      const interval = setInterval(fetchParticipantInfo, 2000); // Every 2 seconds for faster updates
      
      return () => clearInterval(interval);
    } else {
      // Reset when not connected
      setActiveParticipantNames(new Set());
      setParticipantNameToUserId(new Map());
      setUserIdToDisplayName(new Map());
      setHostDisplayName(null);
    }
  }, [isConnected, meeting?.id, meeting?.host_id]);
  
  // Also fetch participant info when peers change (to update host badge immediately)
  useEffect(() => {
    if (isConnected && meeting?.id && peers.length > 0) {
      const fetchParticipantInfo = async () => {
        try {
          const response = await fetch(`/api/meetings/participants?meetingId=${meeting.id}`);
          if (response.ok) {
            const data = await response.json();
            const participants = data.participants || [];
            
            // Update host display name immediately when peers change
            if (meeting.host_id) {
              const hostParticipant = participants.find((p: any) => 
                p.user_id === meeting.host_id && p.role === "host"
              );
              if (hostParticipant?.display_name && hostDisplayName !== hostParticipant.display_name) {
                setHostDisplayName(hostParticipant.display_name);
              }
            }
          }
        } catch (err) {
          // Silently fail - main polling will handle it
        }
      };
      
      // Debounce to avoid too many requests
      const timeout = setTimeout(fetchParticipantInfo, 500);
      return () => clearTimeout(timeout);
    }
  }, [peers.length, isConnected, meeting?.id, meeting?.host_id, hostDisplayName]);
  
  // Sync hand raise state from peers' metadata on peer update
  useEffect(() => {
    if (!isConnected || !peers.length) return;
    
    peers.forEach((peer) => {
      if (peer.metadata) {
        try {
          const metadata = typeof peer.metadata === 'string' ? JSON.parse(peer.metadata) : peer.metadata;
          if (metadata.handRaised !== undefined && metadata.peerId === peer.id) {
            setRaisedHands(prev => {
              if (prev.get(peer.id) !== metadata.handRaised) {
                const updated = new Map(prev);
                updated.set(peer.id, metadata.handRaised);
                return updated;
              }
              return prev;
            });
          }
        } catch (err) {
          // Ignore parse errors
        }
      }
    });
  }, [peers, isConnected]);

  async function handleApproveRequest(requestId: string, approve: boolean) {
    try {
      const response = await fetch("/api/meetings/approve-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          approve,
        }),
      });

      if (response.ok) {
        // Refresh pending requests
        const fetchResponse = await fetch(`/api/meetings/pending-requests?meetingId=${meeting?.id}`);
        if (fetchResponse.ok) {
          const data = await fetchResponse.json();
          setPendingRequests(data.requests || []);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update request");
      }
    } catch (err) {
      console.error("Error approving request:", err);
      setError("Failed to update join request");
    }
  }

  // Fetch chat messages
  async function fetchChatMessages() {
    if (!meeting?.id || !isConnected) return;

    try {
      const response = await fetch(`/api/messages?meetingId=${meeting.id}`);
      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];
        
        // Track last message ID to detect new messages
        if (messages.length > 0) {
          const latestId = messages[messages.length - 1].id;
          const hadNewMessage = latestId !== lastMessageId;
          
          setChatMessages(messages);
          
          if (hadNewMessage) {
            setLastMessageId(latestId);
            // Auto-scroll to bottom if chat is open
            if (showChat) {
              setTimeout(() => {
                chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
          }
        } else {
          setChatMessages([]);
          setLastMessageId(null);
        }
      }
    } catch (err) {
      console.error("Error fetching chat messages:", err);
    }
  }

  // Send chat message
  async function handleSendMessage(e?: FormEvent) {
    e?.preventDefault();
    
    if (!meeting?.id || !chatMessageInput.trim() || !displayName.trim() || isSendingMessage) return;

    const messageText = chatMessageInput.trim();
    setChatMessageInput("");
    setIsSendingMessage(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          message: messageText,
          displayName: displayName.trim(),
        }),
      });

      if (response.ok) {
        // Refresh messages immediately after sending
        await fetchChatMessages();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to send message");
        // Restore message input on error
        setChatMessageInput(messageText);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message");
      // Restore message input on error
      setChatMessageInput(messageText);
    } finally {
      setIsSendingMessage(false);
    }
  }

  // Auto-scroll chat to bottom when opened and mark messages as read
  useEffect(() => {
    if (showChat && chatMessages.length > 0) {
      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      // Mark all messages as read when chat is opened
      const latestId = chatMessages[chatMessages.length - 1].id;
      setLastReadMessageId(latestId);
    }
  }, [showChat, chatMessages.length]);

  // Poll for chat messages when connected
  useEffect(() => {
    if (!isConnected || !meeting?.id) {
      setChatMessages([]);
      setLastMessageId(null);
      return;
    }

    // Fetch immediately
    fetchChatMessages();

    // Poll every 2 seconds for new messages
    const interval = setInterval(() => {
      fetchChatMessages();
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, meeting?.id, lastMessageId, showChat]);

  // Fetch files for the meeting
  async function fetchFiles() {
    if (!meeting?.id || !isConnected) return;

    try {
      const response = await fetch(`/api/files/list?meetingId=${meeting.id}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error("Error fetching files:", err);
    }
  }

  // Handle file upload
  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile || !meeting?.id || !displayName.trim() || uploading) return;

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      setError(`File size exceeds 10MB limit. Selected file is ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("meetingId", meeting.id);
      formData.append("displayName", displayName.trim());

      // Use XMLHttpRequest for upload progress
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", async () => {
        if (xhr.status === 200) {
          // Refresh files list
          await fetchFiles();
          setUploadProgress(100);
          setTimeout(() => {
            setUploadProgress(0);
            setUploading(false);
          }, 500);
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setError(errorData.error || "Failed to upload file");
          setUploading(false);
          setUploadProgress(0);
        }
      });

      xhr.addEventListener("error", () => {
        setError("Failed to upload file");
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.open("POST", "/api/files/upload");
      xhr.send(formData);
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Failed to upload file");
      setUploading(false);
      setUploadProgress(0);
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
        setError(errorData.error || "Failed to download file");
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      setError("Failed to download file");
    }
  }

  // Handle file delete
  async function handleFileDelete(fileId: string) {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(`/api/files/delete?fileId=${fileId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        // Refresh files list
        await fetchFiles();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete file");
      }
    } catch (err) {
      console.error("Error deleting file:", err);
      setError("Failed to delete file");
    }
  }

  // Poll for files when connected
  useEffect(() => {
    if (!isConnected || !meeting?.id) {
      setFiles([]);
      return;
    }

    // Fetch immediately
    fetchFiles();

    // Poll every 3 seconds for new files
    const interval = setInterval(() => {
      fetchFiles();
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, meeting?.id]);

  // Fetch recording status
  async function fetchRecordingStatus() {
    if (!meeting?.id || !isConnected) {
      setIsRecording(false);
      setActiveRecording(null);
      return;
    }

    try {
      const response = await fetch(`/api/recordings/status?meetingId=${meeting.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setCanRecord(data.canRecord || false);
          setAllowParticipantsToRecord(data.allowParticipantsToRecord || false);
          setIsRecording(data.isRecording || false);
          setActiveRecording(data.activeRecording || null);
        }
      }
    } catch (err) {
      console.error("Error fetching recording status:", err);
    }
  }

  // Start recording
  async function handleStartRecording() {
    if (!meeting?.id || !canRecord || isStartingRecording || isRecording) return;

    setIsStartingRecording(true);
    try {
      const response = await fetch("/api/recordings/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id }),
      });

      const data = await response.json();
      if (data.ok) {
        await fetchRecordingStatus();
      } else {
        alert(data.error || "Failed to start recording");
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Failed to start recording");
    } finally {
      setIsStartingRecording(false);
    }
  }

  // Stop recording
  async function handleStopRecording() {
    if (!meeting?.id || !canRecord || isStoppingRecording || !isRecording) return;

    setIsStoppingRecording(true);
    try {
      const response = await fetch("/api/recordings/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          meetingId: meeting.id,
          recordingId: activeRecording?.id || null,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        await fetchRecordingStatus();
      } else {
        alert(data.error || "Failed to stop recording");
      }
    } catch (err) {
      console.error("Error stopping recording:", err);
      alert("Failed to stop recording");
    } finally {
      setIsStoppingRecording(false);
    }
  }

  // Toggle participant recording permission (host only)
  async function handleTogglePermission() {
    if (!meeting?.id || !isHost || isTogglingPermission) return;

    setIsTogglingPermission(true);
    try {
      const response = await fetch("/api/recordings/permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          meetingId: meeting.id,
          allowParticipantsToRecord: !allowParticipantsToRecord,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        setAllowParticipantsToRecord(data.allowParticipantsToRecord);
      } else {
        alert(data.error || "Failed to toggle permission");
      }
    } catch (err) {
      console.error("Error toggling permission:", err);
      alert("Failed to toggle permission");
    } finally {
      setIsTogglingPermission(false);
    }
  }

  // Poll for recording status when connected
  useEffect(() => {
    if (!isConnected || !meeting?.id) {
      setIsRecording(false);
      setActiveRecording(null);
      return;
    }

    fetchRecordingStatus();
    // Poll every 2 seconds for recording status
    const interval = setInterval(() => {
      fetchRecordingStatus();
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, meeting?.id]);

  // Host can toggle remote participants' audio/video
  async function handleToggleRemoteAudio(peerId: string, enabled: boolean) {
    if (!isHost || !hmsActions) return;

    try {
      // Find the peer
      const peer = peers.find((p) => p.id === peerId);
      if (!peer) {
        throw new Error("Peer not found");
      }

      // Get audio track ID
      let audioTrackId: string | undefined;
      if (typeof peer.audioTrack === "string") {
        audioTrackId = peer.audioTrack;
      } else if (peer.audioTrack?.id) {
        audioTrackId = peer.audioTrack.id;
      }

      // If track ID not directly available, look it up in tracksMap
      if (!audioTrackId && tracksMap) {
        const allTracks = Object.values(tracksMap);
        const peerAudioTrack = allTracks.find((track: any) => {
          return (track.peerId === peerId || track.peer?.id === peerId) && track.type === "audio";
        });
        audioTrackId = peerAudioTrack?.id;
      }

      if (!audioTrackId) {
        throw new Error("Audio track not found");
      }

      // Get the actual track object from tracksMap
      const track = tracksMap?.[audioTrackId];
      
      console.log("Host toggling remote audio:", { 
        peerId, 
        peerName: peer.name,
        enabled, 
        audioTrackId,
        hasTrack: !!track 
      });
      
      // Try multiple methods to change remote track state
      // Method 1: Try changeTrackState if available
      if (typeof (hmsActions as any).changeTrackState === "function") {
        await (hmsActions as any).changeTrackState(audioTrackId, enabled);
      } 
      // Method 2: Try setRemoteTrackEnabled if available
      else if (typeof (hmsActions as any).setRemoteTrackEnabled === "function") {
        await (hmsActions as any).setRemoteTrackEnabled(audioTrackId, enabled);
      }
      // Method 3: Try setTrackState if available
      else if (typeof (hmsActions as any).setTrackState === "function" && track) {
        await (hmsActions as any).setTrackState(track, enabled);
      }
      else {
        // Fallback: Log warning that method not available
        console.warn("Remote track control methods not available in HMS SDK. Check role permissions.");
        throw new Error("Remote track control not available. Check 100ms role permissions.");
      }
      
      console.log("Remote audio toggle successful");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to toggle remote audio";
      console.error("Failed to toggle remote audio:", err);
      setToggleError(errorMsg);
      setTimeout(() => setToggleError(null), 3000);
    }
  }

  async function handleToggleRemoteVideo(peerId: string, enabled: boolean) {
    if (!isHost || !hmsActions) return;

    try {
      // Find the peer
      const peer = peers.find((p) => p.id === peerId);
      if (!peer) {
        throw new Error("Peer not found");
      }

      // Get video track ID
      let videoTrackId: string | undefined;
      if (typeof peer.videoTrack === "string") {
        videoTrackId = peer.videoTrack;
      } else if (peer.videoTrack?.id) {
        videoTrackId = peer.videoTrack.id;
      }

      // If track ID not directly available, look it up in tracksMap
      if (!videoTrackId && tracksMap) {
        const allTracks = Object.values(tracksMap);
        const peerVideoTrack = allTracks.find((track: any) => {
          return (track.peerId === peerId || track.peer?.id === peerId) && track.type === "video";
        });
        videoTrackId = peerVideoTrack?.id;
      }

      if (!videoTrackId) {
        throw new Error("Video track not found");
      }

      // Get the actual track object from tracksMap
      const track = tracksMap?.[videoTrackId];
      
      console.log("Host toggling remote video:", { 
        peerId, 
        peerName: peer.name,
        enabled, 
        videoTrackId,
        hasTrack: !!track 
      });
      
      // Try multiple methods to change remote track state
      // Method 1: Try changeTrackState if available
      if (typeof (hmsActions as any).changeTrackState === "function") {
        await (hmsActions as any).changeTrackState(videoTrackId, enabled);
      } 
      // Method 2: Try setRemoteTrackEnabled if available
      else if (typeof (hmsActions as any).setRemoteTrackEnabled === "function") {
        await (hmsActions as any).setRemoteTrackEnabled(videoTrackId, enabled);
      }
      // Method 3: Try setTrackState if available
      else if (typeof (hmsActions as any).setTrackState === "function" && track) {
        await (hmsActions as any).setTrackState(track, enabled);
      }
      else {
        // Fallback: Log warning that method not available
        console.warn("Remote track control methods not available in HMS SDK. Check role permissions.");
        throw new Error("Remote track control not available. Check 100ms role permissions.");
      }
      
      console.log("Remote video toggle successful");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to toggle remote video";
      console.error("Failed to toggle remote video:", err);
      setToggleError(errorMsg);
      setTimeout(() => setToggleError(null), 3000);
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
      // Mark as connected in localStorage with timestamp
      if (meeting?.id && user?.id) {
        const storageKey = `hms_connected_${meeting.id}_${user.id}`;
        localStorage.setItem(storageKey, Date.now().toString());
      }
    } else {
      // Clear storage if disconnected
      if (meeting?.id && user?.id) {
        const storageKey = `hms_connected_${meeting.id}_${user.id}`;
        localStorage.removeItem(storageKey);
      }
    }
  }, [isConnected, meeting?.id, user?.id]);

  // Listen for leave signals from other tabs (when same user joins from another tab)
  useEffect(() => {
    if (!meeting?.id || !user?.id || !isConnected) return;

    const leaveSignalKey = `hms_leave_${meeting.id}_${user.id}`;
    let isLeaving = false;
    
    const performLeave = async () => {
      if (isLeaving) return;
      isLeaving = true;
      console.log("Received leave signal from another tab - leaving meeting");
      
      try {
        // Clear the signal
        localStorage.removeItem(leaveSignalKey);
        
        // Leave HMS room
        await hmsActions.leave();
        
        // Record leaving
        try {
          await fetch("/api/meetings/leave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              meetingId: meeting.id,
            }),
          });
        } catch (err) {
          console.error("Error recording leave:", err);
        }
        
        // Navigate away
        router.push("/meetings");
      } catch (err) {
        console.error("Error leaving meeting:", err);
        isLeaving = false;
      }
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      // Check if this is a leave signal for this user
      if (e.key === leaveSignalKey && e.newValue) {
        performLeave();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Also check immediately in case signal was set before listener was added
    const checkLeaveSignal = () => {
      const signal = localStorage.getItem(leaveSignalKey);
      if (signal) {
        performLeave();
      }
    };
    
    // Check periodically (in case signal was set in same tab before listener)
    const interval = setInterval(checkLeaveSignal, 500);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [meeting?.id, user?.id, isConnected, hmsActions, router]);

  // Set default display name from user email if not set
  useEffect(() => {
    if (user?.email && !displayName && !isConnected) {
      // Extract name from email (part before @) or use email as fallback
      const emailName = user.email.split("@")[0];
      setDisplayName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
    }
  }, [user?.email, displayName, isConnected]);

  async function handleLeave() {
    try {
      // Clear localStorage
      if (meeting?.id && user?.id) {
        const storageKey = `hms_connected_${meeting.id}_${user.id}`;
        localStorage.removeItem(storageKey);
      }

      // Record leaving
      if (meeting?.id) {
        await fetch("/api/meetings/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId: meeting.id,
          }),
        });
      }
    } catch (err) {
      console.error("Error recording leave:", err);
    }

    await hmsActions.leave();
    router.push("/meetings");
  }

  // Handle page visibility change (tab switch/refresh)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isConnected && meeting?.id) {
        // Page became visible - check if still connected
        // HMS SDK should handle reconnection automatically
        console.log("Page visible, checking connection state");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isConnected, meeting?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // On unmount, clear session storage if still connected
      // This allows rejoin after refresh
      if (meeting?.id && user?.id) {
        const sessionKey = `hms_connected_${meeting.id}_${user.id}`;
        // Don't clear here - let leave handler do it
        // Otherwise refresh won't work
      }
    };
  }, [meeting?.id, user?.id]);

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
        {/* Soft gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.07),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.09),_transparent_55%)]" />
        <p className="rounded-xl border border-slate-800/80 bg-slate-900/80 px-5 py-3 text-sm text-slate-200 shadow-lg shadow-slate-950/60 backdrop-blur">
          Loading meeting...
        </p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
        {/* Soft gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.06),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.06),_transparent_55%)]" />
        <div className="rounded-2xl border border-rose-500/30 bg-slate-900/90 px-8 py-6 text-center shadow-2xl shadow-slate-950/70 backdrop-blur">
          <p className="text-sm font-medium text-rose-200">
            {error || "Meeting not found"}
          </p>
          <button
            onClick={() => router.push("/meetings")}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-900/40 transition-all hover:from-sky-400 hover:to-indigo-400 hover:shadow-md hover:scale-[1.02] active:scale-95"
          >
            Back to Meetings
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    // Show waiting room if waiting for approval
    if (isWaitingForApproval) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
          <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-8">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-600 border-t-sky-500"></div>
              </div>
              <h1 className="text-2xl font-semibold">Waiting for Approval</h1>
              <p className="mt-2 text-sm text-slate-300">
                Your join request has been sent to the host. Please wait...
              </p>
              <p className="mt-4 text-xs text-slate-400">
                Meeting: {meeting.title}
              </p>
            </div>
            
            <button
              onClick={() => {
                setIsWaitingForApproval(false);
                setRequestId(null);
              }}
              className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
            >
              Cancel Request
            </button>
          </div>
        </div>
      );
    }

    // Show join form
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-6 py-16 text-slate-100">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute left-1/4 top-6 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-500/16 via-indigo-500/12 to-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 bottom-0 -z-10 h-72 w-72 translate-x-1/3 translate-y-1/3 rounded-full bg-gradient-to-tr from-violet-500/10 via-sky-500/8 to-emerald-400/8 blur-3xl" />

        <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-8 shadow-xl shadow-slate-950/70 backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-2xl hover:border-sky-500/60">
          {/* Close button */}
          <button
            type="button"
            onClick={() => router.push("/meetings")}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/70 text-slate-300 shadow-sm shadow-slate-950/50 transition hover:bg-slate-800 hover:text-white hover:border-slate-500 active:scale-95"
            title="Back to meetings"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{meeting.title}</h1>
            {meeting.description && (
              <p className="text-sm text-slate-300">{meeting.description}</p>
            )}
            {isHost && (
              <p className="text-xs font-semibold text-emerald-400">You are the host</p>
            )}
          </div>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="mb-2 block text-sm font-medium text-slate-200">
                Your Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm shadow-slate-950/40 transition-colors duration-150 ease-out hover:border-slate-500 hover:bg-slate-900/90 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-600/80"
                disabled={joining}
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-400">
                This name will be displayed in the meeting.
              </p>
            </div>
            
            <button
              type="submit"
              disabled={joining || !displayName.trim()}
              className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-900/40 transition-all duration-150 ease-out hover:from-sky-400 hover:to-indigo-400 hover:shadow-md hover:ring-2 hover:ring-sky-400/50 hover:scale-[1.01] active:scale-95 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? "Joining..." : isHost ? "Start Meeting" : "Request to Join"}
            </button>
            
            {error && <p className="text-center text-sm text-rose-300">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Subtle background gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.09),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.1),_transparent_60%)]" />

      <header className="flex-shrink-0 border-b border-slate-800/80 bg-slate-950/85 px-4 py-3 shadow-lg shadow-slate-950/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-white">
                {meeting.title}
              </h1>
              {meeting.description && (
                <p className="line-clamp-1 text-xs text-slate-400">
                  {meeting.description}
                </p>
              )}
            </div>
            
            {/* Recording Status Indicator - visible to all */}
            {isConnected && isRecording && (
              <div className="flex h-9 items-center gap-2 rounded-full border border-red-500/50 bg-gradient-to-r from-red-600 to-rose-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-red-900/60">
                <div className="relative flex items-center justify-center">
                  <div className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-white/80 opacity-75" />
                  <div className="relative h-2 w-2 rounded-full bg-white" />
                </div>
                <span className="whitespace-nowrap tracking-tight">
                  Recording
                </span>
                {activeRecording?.startedByName && (
                  <span className="whitespace-nowrap rounded-full bg-red-700/60 px-2 py-0.5 text-[10px] text-red-100">
                    by {activeRecording.startedByName}
                  </span>
                )}
              </div>
            )}

            {/* Meeting duration stopwatch */}
            {isConnected && (
              <div className="flex h-9 items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/80 px-3.5 text-[11px] font-medium text-slate-100 shadow-sm shadow-slate-950/60">
                <svg
                  className="h-3.5 w-3.5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l2.5 2.5M9 3h6M19 10a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="tabular-nums tracking-tight">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
            )}
            
            {/* Raise Hand Button - in header beside meeting name */}
            {isConnected && localPeer && (
              <button
                onClick={() => {
                  const currentState = raisedHands.get(localPeer.id) || false;
                  const newState = !currentState;
                  setRaisedHands(prev => {
                    const updated = new Map(prev);
                    updated.set(localPeer.id, newState);
                    return updated;
                  });
                  
                  // Broadcast hand raise state via HMS metadata
                  if (hmsActions) {
                    try {
                      // Use HMS metadata to broadcast hand raise state
                      hmsActions.changeMetadata(JSON.stringify({
                        handRaised: newState,
                        peerId: localPeer.id,
                        timestamp: Date.now(),
                      }));
                    } catch (err) {
                      console.error("Error broadcasting hand raise:", err);
                    }
                  }
                }}
                className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-medium transition-all active:scale-95 ${
                  raisedHands.get(localPeer.id) 
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 shadow-sm shadow-yellow-700/40 animate-pulse" 
                    : "bg-slate-700 text-white hover:bg-slate-600 shadow-sm shadow-slate-950/60"
                }`}
                title={raisedHands.get(localPeer.id) ? "Lower Hand" : "Raise Hand"}
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
                <span className="whitespace-nowrap">{raisedHands.get(localPeer.id) ? "Lower" : "Raise Hand"}</span>
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Screen Share Button - distinguishable from recording */}
            {isConnected && localPeer && (
              <button
                onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-white shadow-sm shadow-slate-950/60 transition-all active:scale-95 ${
                  isScreenSharing
                    ? "border-sky-500/80 bg-sky-600 hover:bg-sky-500 shadow-sky-900/70"
                    : "border-slate-700/60 bg-slate-800/80 hover:border-sky-500/70 hover:bg-slate-800"
                }`}
                title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
              >
                {isScreenSharing ? (
                  // Active screen share - monitor with diagonal slash
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="12" rx="2" ry="2" />
                    <line x1="9" y1="20" x2="15" y2="20" />
                    <line x1="12" y1="16" x2="12" y2="20" />
                    <line x1="5" y1="6" x2="19" y2="14" />
                  </svg>
                ) : (
                  // Share screen - monitor/screen icon
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <path d="M7 8l5-5 5 5" />
                  </svg>
                )}
              </button>
            )}
            
            {/* Recording Controls - Clear icons */}
            {isConnected && canRecord && (
              <>
                {/* Start/Stop Recording Button */}
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={(isRecording && (isStoppingRecording || !canRecord)) || (!isRecording && (isStartingRecording || !canRecord))}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-red-600/70 text-white shadow-sm shadow-red-900/70 transition-all duration-200 hover:bg-red-600/90 active:scale-95 ${
                    isRecording
                      ? isStoppingRecording
                        ? "bg-slate-900/60 cursor-not-allowed opacity-60"
                        : "bg-red-600/90"
                      : isStartingRecording
                        ? "bg-slate-900/60 cursor-not-allowed opacity-60"
                        : "bg-red-600/90"
                  }`}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  {isRecording ? (
                    // Stop recording - filled square
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <rect x="6" y="6" width="8" height="8" rx="1" fill="currentColor" />
                    </svg>
                  ) : (
                    // Start recording - filled red circle (record button)
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="6" fill="currentColor" />
                    </svg>
                  )}
                </button>
                
                {/* Permission Toggle Button (Host only) - Lock/Unlock icon */}
                {isHost && (
                  <button
                    onClick={handleTogglePermission}
                    disabled={isTogglingPermission}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs transition-all duration-200 active:scale-95 ${
                      allowParticipantsToRecord
                        ? "border-emerald-500/70 bg-emerald-600/90 text-white shadow-sm shadow-emerald-900/60 hover:bg-emerald-500"
                        : "border-slate-600/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                    } ${isTogglingPermission ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={allowParticipantsToRecord ? "Only Host Can Record (Click to Restrict)" : "All Participants Can Record (Click to Allow)"}
                  >
                    {allowParticipantsToRecord ? (
                      // Unlock icon - everyone can record (green = open/unlocked)
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0v1a1 1 0 102 0V7a5 5 0 00-5-5z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      // Lock icon - only host can record (gray = locked)
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )}
              </>
            )}
            
            {isHost && pendingRequests.length > 0 && (
              <button
                onClick={() => setShowHostPanel(!showHostPanel)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-yellow-400/70 bg-yellow-500 text-black shadow-sm shadow-yellow-700/60 transition hover:bg-yellow-400 active:scale-95"
                title={`${pendingRequests.length} Pending Request${pendingRequests.length > 1 ? 's' : ''}`}
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black px-1.5 text-xs font-bold text-white">
                  {pendingRequests.length}
                </span>
              </button>
            )}
            
            {/* Files Button - Icon only */}
            <button
              onClick={() => setShowFiles(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/90 text-white shadow-sm shadow-slate-950/60 transition hover:border-sky-500/70 hover:bg-slate-800 active:scale-95"
              title={`Files${files.length > 0 ? ` (${files.length})` : ''}`}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              {files.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-bold text-white">
                  {files.length > 99 ? '99+' : files.length}
                </span>
              )}
            </button>
            
            {/* Chat Button - Icon only */}
            <button
              onClick={() => setShowChat(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/90 text-white shadow-sm shadow-slate-950/60 transition hover:border-sky-500/70 hover:bg-slate-800 active:scale-95"
              title="Chat"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              {(() => {
                // Count unread messages (messages after last read)
                let unreadCount = 0;
                if (chatMessages.length > 0) {
                  if (!lastReadMessageId) {
                    unreadCount = chatMessages.length;
                  } else {
                    const lastReadIndex = chatMessages.findIndex((m: any) => m.id === lastReadMessageId);
                    if (lastReadIndex === -1) {
                      unreadCount = chatMessages.length;
                    } else {
                      unreadCount = chatMessages.length - lastReadIndex - 1;
                    }
                  }
                }
                
                // Show badge if there are unread messages when chat is closed
                if (!showChat && unreadCount > 0) {
                  return (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>
            
            {/* Participants List Button - Icon only */}
            <button
              onClick={() => setShowParticipantsList(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/90 text-white shadow-sm shadow-slate-950/60 transition hover:border-sky-500/70 hover:bg-slate-800 active:scale-95"
              title={`Participants (${activeParticipantNames.size > 0 ? activeParticipantNames.size : peers.length > 0 ? peers.length : 0})`}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-600 px-1.5 text-xs font-bold text-white">
                {activeParticipantNames.size > 0 
                  ? activeParticipantNames.size 
                  : peers.length > 0 ? peers.length : 0}
              </span>
            </button>
            
            {/* Leave Button - Icon only */}
            <button
              onClick={handleLeave}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/80 bg-rose-600/95 text-white shadow-sm shadow-rose-900/70 transition hover:bg-rose-500 active:scale-95"
              title="Leave Meeting"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        {isHost && showHostPanel && (
          <div className="mt-4 rounded-xl border border-slate-700/80 bg-slate-900/95 p-4 shadow-lg shadow-slate-950/70 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Pending Join Requests
              </h2>
              <button
                onClick={() => setShowHostPanel(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-slate-400">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-900/90 p-3 shadow-sm shadow-slate-950/60"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {request.display_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Requested {new Date(request.requested_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(request.id, true)}
                        className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-400"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproveRequest(request.id, false)}
                        className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-400"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>
      <main className="flex-1 overflow-hidden px-4 py-3">
        <div className="mx-auto flex h-full max-w-7xl flex-col rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 shadow-xl shadow-slate-950/70 backdrop-blur">
          {/* Video Grid */}
          {(() => {
            // Filter and process peers first
            const filteredPeers = (() => {
              // Step 1: Group peers by user_id (if we can identify them) or by name
              // First, try to identify which user_id each peer belongs to
              const peerToUserId = new Map<string, string>(); // peer.id -> user_id
              const peersByUserId = new Map<string, any[]>(); // user_id -> peers[]
              const peersByName = new Map<string, any[]>(); // name -> peers[] (fallback)
              
              // First, add all peers - try to match by name to user_id
              peers.forEach((peer) => {
                const name = peer.name || "";
                const userId = participantNameToUserId.get(name);
                
                if (userId) {
                  // Peer's name matches current active participant name
                  peerToUserId.set(peer.id, userId);
                  if (!peersByUserId.has(userId)) {
                    peersByUserId.set(userId, []);
                  }
                  peersByUserId.get(userId)!.push(peer);
                } else {
                  // Can't match to user_id - add to name-based group for now
                  if (!peersByName.has(name)) {
                    peersByName.set(name, []);
                  }
                  peersByName.get(name)!.push(peer);
                }
              });
              
              
              // Step 2: For each user_id group, keep only ONE peer (prefer current display name)
              // Then do the same for name-based groups (fallback)
              const uniquePeers: any[] = [];
              
              // Process user_id-based groups first
              peersByUserId.forEach((peerGroup, userId) => {
                // Get current display name for this user
                const currentDisplayName = userIdToDisplayName.get(userId) || "";
                
                // Prefer peer with current display name, otherwise pick best one
                let keptPeer: any = null;
                
                // First, try to find peer with current display name
                const peerWithCurrentName = peerGroup.find(p => (p.name || "") === currentDisplayName);
                
                if (peerWithCurrentName) {
                  keptPeer = peerWithCurrentName;
                  console.log(`User ${userId} has multiple peers: keeping peer with current name "${currentDisplayName}" (ID: ${keptPeer.id})`);
                } else {
                  // No peer with current name, pick the best one
                  const localPeerInGroup = peerGroup.find(p => localPeer && p.id === localPeer.id);
                  
                  if (localPeerInGroup) {
                    keptPeer = localPeerInGroup;
                    console.log(`User ${userId} has multiple peers: keeping local peer (ID: ${keptPeer.id})`);
                  } else {
                    // Sort by track availability
                    const sortedByTracks = [...peerGroup].sort((a, b) => {
                      const aHasVideo = !!a.videoTrack;
                      const bHasVideo = !!b.videoTrack;
                      const aHasAudio = !!a.audioTrack;
                      const bHasAudio = !!b.audioTrack;
                      
                      if (aHasVideo && !bHasVideo) return -1;
                      if (!aHasVideo && bHasVideo) return 1;
                      if (aHasAudio && !bHasAudio) return -1;
                      if (!aHasAudio && bHasAudio) return 1;
                      return 0;
                    });
                    
                    keptPeer = sortedByTracks[0];
                    console.log(`User ${userId} has multiple peers: keeping peer with best tracks (ID: ${keptPeer.id})`);
                  }
                }
                
                // Log filtered peers
                peerGroup.forEach((peer) => {
                  if (peer.id !== keptPeer.id) {
                    console.log(`Filtering out peer for user ${userId}: "${peer.name || ""}" (ID: ${peer.id}) - user has new name "${currentDisplayName}"`);
                  }
                });
                
                uniquePeers.push(keptPeer);
              });
              
              // Step 3: Process name-based groups (peers we couldn't match to user_id)
              peersByName.forEach((peerGroup, name) => {
                // Skip if we already processed this peer via user_id grouping
                const alreadyProcessed = peerGroup.some(p => peerToUserId.has(p.id));
                if (alreadyProcessed) {
                  return; // Already handled in user_id grouping
                }
                
                let keptPeer: any;
                
                if (peerGroup.length === 1) {
                  keptPeer = peerGroup[0];
                } else {
                  // Multiple peers with same name but unknown user_id
                  const localPeerInGroup = peerGroup.find(p => localPeer && p.id === localPeer.id);
                  
                  if (localPeerInGroup) {
                    keptPeer = localPeerInGroup;
                    console.log(`Duplicate peers found for "${name}": keeping local peer ${keptPeer.id}`);
                  } else {
                    const sortedByTracks = [...peerGroup].sort((a, b) => {
                      const aHasVideo = !!a.videoTrack;
                      const bHasVideo = !!b.videoTrack;
                      const aHasAudio = !!a.audioTrack;
                      const bHasAudio = !!b.audioTrack;
                      
                      if (aHasVideo && !bHasVideo) return -1;
                      if (!aHasVideo && bHasVideo) return 1;
                      if (aHasAudio && !bHasAudio) return -1;
                      if (!aHasAudio && bHasAudio) return 1;
                      return 0;
                    });
                    
                    keptPeer = sortedByTracks[0];
                    console.log(`Duplicate peers found for "${name}": keeping peer ${keptPeer.id} with best tracks`);
                  }
                  
                  peerGroup.forEach((peer) => {
                    if (peer.id !== keptPeer.id) {
                      console.log(`Filtering out duplicate peer: ${name} (ID: ${peer.id})`);
                    }
                  });
                }
                
                uniquePeers.push(keptPeer);
              });
              
              // Step 4: Filter out disconnected peers and old peers (not in active participants)
              return uniquePeers.filter((keptPeer) => {
                // Always include local peer
                if (keptPeer.id === localPeer?.id) {
                  return true;
                }
                
                const peerName = keptPeer.name || "";
                const isInActiveParticipants = activeParticipantNames.has(peerName);
                
                // Check if peer has tracks
                const hasVideoTrack = !!keptPeer.videoTrack;
                const hasAudioTrack = !!keptPeer.audioTrack;
                const hasAnyTrack = hasVideoTrack || hasAudioTrack;
                
                // If peer's name is not in active participants, it's either:
                // 1. An old peer (user changed display name) - filter it out
                // 2. A disconnected peer - filter it out
                // 3. A peer that hasn't created participant record yet - but should be filtered anyway
                if (!isInActiveParticipants) {
                  // Not in active participants - this is an old/disconnected peer
                  console.log(`Filtering out old/disconnected peer: "${peerName}" (ID: ${keptPeer.id}) - not in active participants`);
                  return false;
                }
                
                // Peer is in active participants - include it
                // (We already have tracks check if needed, but being in active participants is sufficient)
                return true;
              });
            })();

            // Helper function to get tracks for a peer
            const getPeerTracks = (peer: any) => {
              let videoTrack: any = null;
              let audioTrack: any = null;
              let screenShareTrack: any = null;
              
              const videoTrackRef = peer.videoTrack;
              const audioTrackRef = peer.audioTrack;
              
              // Get video track (camera, not screen share)
              if (videoTrackRef) {
                if (typeof videoTrackRef === "string") {
                  const track = tracksMap?.[videoTrackRef];
                  if (track && track.source !== "screen") {
                    videoTrack = track;
                  }
                } else if (videoTrackRef.source !== "screen") {
                  videoTrack = videoTrackRef;
                }
              }
              
              if (!videoTrack && peer.id === localPeer?.id && localVideoTrackID) {
                const track = tracksMap?.[localVideoTrackID];
                if (track && track.source !== "screen") {
                  videoTrack = track;
                }
              }
              
              if (!videoTrack && tracksMap) {
                const allTracks = Object.values(tracksMap);
                const peerTracks = allTracks.filter((track: any) => {
                  return (track.peerId === peer.id || track.peer?.id === peer.id) && 
                         track.type === "video" && 
                         track.source !== "screen";
                });
                if (peerTracks.length > 0) {
                  videoTrack = peerTracks[0] as any;
                }
              }
              
              // Get screen share track
              if (tracksMap) {
                const allTracks = Object.values(tracksMap);
                const screenTracks = allTracks.filter((track: any) => {
                  return (track.peerId === peer.id || track.peer?.id === peer.id) && 
                         track.type === "video" && 
                         track.source === "screen";
                });
                if (screenTracks.length > 0) {
                  screenShareTrack = screenTracks[0] as any;
                }
              }
              
              // Get audio track
              if (audioTrackRef) {
                if (typeof audioTrackRef === "string") {
                  audioTrack = tracksMap?.[audioTrackRef];
                } else {
                  audioTrack = audioTrackRef;
                }
              }
              
              if (!audioTrack && peer.id === localPeer?.id && localAudioTrackID) {
                audioTrack = tracksMap?.[localAudioTrackID];
              }
              
              if (!audioTrack && tracksMap) {
                const allTracks = Object.values(tracksMap);
                const peerTracks = allTracks.filter((track: any) => {
                  return (track.peerId === peer.id || track.peer?.id === peer.id) && track.type === "audio";
                });
                if (peerTracks.length > 0) {
                  audioTrack = peerTracks[0] as any;
                }
              }
              
              return { videoTrack, audioTrack, screenShareTrack };
            };
            
            // Find all peers with active screen shares
            const getScreenSharePeers = () => {
              const screenSharePeers: Array<{ peer: any; track: any }> = [];
              filteredPeers.forEach((peer) => {
                const { screenShareTrack } = getPeerTracks(peer);
                if (screenShareTrack) {
                  screenSharePeers.push({ peer, track: screenShareTrack });
                }
              });
              return screenSharePeers;
            };
            
            // Helper function to check if peer is host
            const isPeerHost = (peer: any) => {
              return (
                (peer.id === localPeer?.id && user?.id === meeting.host_id) ||
                (meeting.host_email && peer.name?.toLowerCase() === meeting.host_email.toLowerCase()) ||
                (hostDisplayName && peer.name?.toLowerCase() === hostDisplayName.toLowerCase()) ||
                (meeting.host_email && peer.name?.toLowerCase().includes(meeting.host_email.split("@")[0]?.toLowerCase() || "")) ||
                (hostDisplayName && peer.name?.toLowerCase().includes(hostDisplayName.toLowerCase()))
              );
            };
            
            const currentUserIsHost = user?.id === meeting.host_id;
            
            // Render video tile component
            const renderVideoTile = (peer: any, shouldMaximize = false, useScreenShare = false) => {
              const { videoTrack, audioTrack, screenShareTrack } = getPeerTracks(peer);
              const isPeerHostValue = isPeerHost(peer);
              
              // Use screen share track if requested and available
              const displayTrack = useScreenShare && screenShareTrack ? screenShareTrack : videoTrack;
              
              // Create unique key for this tile
              const tileUniqueKey = useScreenShare ? `${peer.id}-screen` : peer.id;
              const isMaximized = maximizedPeerId === tileUniqueKey || shouldMaximize;
              
              return (
                <div
                  key={`${peer.id}-${useScreenShare ? 'screen' : 'video'}`}
                  onClick={() => handleToggleMaximize(peer.id, useScreenShare)}
                  className={`relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-lg transition-all hover:-translate-y-0.5 hover:border-sky-500 hover:shadow-2xl ${
                    isMaximized ? "ring-2 ring-sky-500" : ""
                  } ${useScreenShare ? "ring-2 ring-blue-500" : ""}`}
                  title={isMaximized ? "Click to restore normal view" : "Click to maximize"}
                >
                  <VideoTile 
                    track={displayTrack} 
                    peer={peer} 
                    localPeerId={localPeer?.id}
                    isHost={isPeerHostValue}
                    isLocalHost={currentUserIsHost}
                    audioTrack={audioTrack}
                    onToggleAudio={peer.id === localPeer?.id ? handleToggleAudio : undefined}
                    onToggleVideo={peer.id === localPeer?.id ? handleToggleVideo : undefined}
                    onToggleRemoteAudio={currentUserIsHost && peer.id !== localPeer?.id ? handleToggleRemoteAudio : undefined}
                    onToggleRemoteVideo={currentUserIsHost && peer.id !== localPeer?.id ? handleToggleRemoteVideo : undefined}
                    isHandRaised={raisedHands.get(peer.id) || false}
                  />
                  {useScreenShare && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-blue-600/90 px-2 py-1 text-xs font-semibold text-white">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                      </svg>
                      <span>Screen Share</span>
                    </div>
                  )}
                </div>
              );
            };
            
            // Handle empty state
            if (filteredPeers.length === 0) {
              return (
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/80 px-10 py-8 text-center shadow-inner shadow-slate-950/60">
                    <div className="mb-3 text-5xl">👥</div>
                    <p className="text-sm text-slate-300">
                      Waiting for participants to join the meeting...
                    </p>
                  </div>
                </div>
              );
            }
            
            // Maximized mode: show large tile on left + small tiles for others on right
            // Check if we're maximizing a screen share tile or regular video tile
            // maximizedPeerId format: "peer-id" for video, "peer-id-screen" for screen share
            if (maximizedPeerId) {
              const isMaximizedScreenShare = maximizedPeerId.endsWith('-screen');
              const actualPeerId = isMaximizedScreenShare 
                ? maximizedPeerId.replace('-screen', '') 
                : maximizedPeerId;
              
              const maximizedPeer = filteredPeers.find(p => p.id === actualPeerId);
              
              if (!maximizedPeer) {
                // Peer was removed, restore normal view
                setMaximizedPeerId(null);
                return null;
              }
              
              // Get all tiles except the maximized one
              const screenSharePeers = getScreenSharePeers();
              const allOtherTiles: Array<{ peer: any; isScreenShare: boolean; uniqueKey: string }> = [];
              
              // Add all regular video tiles
              filteredPeers.forEach((peer) => {
                const uniqueKey = `video-${peer.id}`;
                if (uniqueKey !== maximizedPeerId) {
                  allOtherTiles.push({
                    peer,
                    isScreenShare: false,
                    uniqueKey,
                  });
                }
              });
              
              // Add all screen share tiles (except the maximized one if it's a screen share)
              screenSharePeers.forEach(({ peer }) => {
                const uniqueKey = `screen-${peer.id}`;
                if (uniqueKey !== maximizedPeerId) {
                  allOtherTiles.push({
                    peer,
                    isScreenShare: true,
                    uniqueKey,
                  });
                }
              });
              
              return (
                <div className="flex h-full flex-row gap-3">
                  {/* Maximized tile - takes 75% of width */}
                  <div className="min-w-0 flex-1" style={{ flexBasis: "75%" }}>
                    {renderVideoTile(maximizedPeer, true, isMaximizedScreenShare)}
                  </div>
                  
                  {/* Other tiles - small tiles in a vertical column */}
                  {allOtherTiles.length > 0 && (
                    <div
                      className="flex flex-col gap-2 overflow-y-auto"
                      style={{ flexBasis: "25%", width: "25%" }}
                    >
                      {allOtherTiles.map(({ peer, isScreenShare, uniqueKey }) => (
                        <div
                          key={uniqueKey}
                          className="flex-shrink-0"
                          style={{ aspectRatio: "16/9" }}
                        >
                          {renderVideoTile(peer, false, isScreenShare)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            
            // Normal mode: include screen shares as additional tiles in the grid
            const screenSharePeers = getScreenSharePeers();
            
            // Create a combined list: regular video tiles + screen share tiles
            // Each peer with screen share will have both their video tile AND screen share tile
            const allTiles: Array<{ peer: any; isScreenShare: boolean; uniqueKey: string }> = [];
            
            // Add regular video tiles for all peers
            filteredPeers.forEach((peer) => {
              allTiles.push({
                peer,
                isScreenShare: false,
                uniqueKey: `video-${peer.id}`,
              });
            });
            
            // Add screen share tiles as separate tiles
            screenSharePeers.forEach(({ peer }) => {
              allTiles.push({
                peer,
                isScreenShare: true,
                uniqueKey: `screen-${peer.id}`,
              });
            });
            
            // Calculate grid columns based on total tile count
            const gridCols = getOptimalGridCols(allTiles.length);
            const gridColsClass = {
              1: 'grid-cols-1',
              2: 'grid-cols-1 md:grid-cols-2',
              3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
              4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
              5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
              6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
            }[gridCols] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
            
            return (
              <div
                className={`grid h-full gap-3 ${gridColsClass} auto-rows-fr`}
                style={{ gridAutoRows: "minmax(0, 1fr)" }}
              >
                {allTiles.map(({ peer, isScreenShare, uniqueKey }) => (
                  <div key={uniqueKey} className="h-full w-full">
                    {renderVideoTile(peer, false, isScreenShare)}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </main>
      
      {/* Participants List Modal */}
      {showParticipantsList && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowParticipantsList(false)}
          />
          
          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-slate-950/80 backdrop-blur">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Participants</h2>
              <button
                onClick={() => setShowParticipantsList(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title="Close"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Participants List */}
            <div className="max-h-96 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {participantsWithEmails.map((participant: any) => {
                  // Find corresponding peer for status
                  const peer = peers.find(p => {
                    const userId = participantNameToUserId.get(p.name || "");
                    return userId === participant.user_id || p.name === participant.display_name;
                  });
                  
                  const isParticipantHost = participant.user_id === meeting.host_id;
                  const isParticipantLocal = participant.user_id === user?.id;
                  const peerHandRaised = peer ? (raisedHands.get(peer.id) || false) : false;
                  const avatarColor = getAvatarColor(participant.display_name || "");
                  const initials = getInitials(participant.display_name || "");
                  
                  // Get audio and video track enabled status from tracksMap (matching video tiles logic)
                  const audioTrackId = peer?.audioTrack;
                  const audioTrack = audioTrackId && tracksMap ? tracksMap[audioTrackId] : null;
                  const isAudioEnabled = audioTrack?.enabled ?? false;
                  
                  const videoTrackId = peer?.videoTrack;
                  const videoTrack = videoTrackId && tracksMap ? tracksMap[videoTrackId] : null;
                  const isVideoEnabled = videoTrack?.enabled ?? false;
                  
                  return (
                    <div
                      key={participant.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 shadow-sm shadow-slate-950/60 transition hover:-translate-y-0.5 hover:bg-slate-900"
                    >
                      {/* Avatar */}
                      <div className={`${avatarColor} flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-semibold text-white`}>
                        {initials}
                      </div>
                      
                      {/* Name, Email and Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">
                            {participant.display_name || "Unknown"}
                          </p>
                          {isParticipantHost && (
                            <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              Host
                            </span>
                          )}
                          {isParticipantLocal && (
                            <span className="text-xs text-slate-400">(You)</span>
                          )}
                        </div>
                        
                        {/* Email */}
                        {participant.email && (
                          <p className="mt-1 text-xs text-slate-400 truncate">
                            {participant.email}
                          </p>
                        )}
                        
                        {/* Status indicators - matching video tiles */}
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          {peer ? (
                            <>
                              {/* Mic status */}
                              <div className="flex items-center gap-1">
                                <div 
                                  className={`h-2 w-2 rounded-full ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}`} 
                                  title={isAudioEnabled ? "Microphone on" : "Microphone off"}
                                />
                                <span className="text-xs text-slate-400">
                                  {isAudioEnabled ? "Mic on" : "Mic off"}
                                </span>
                              </div>
                              
                              {/* Camera status */}
                              <div className="flex items-center gap-1">
                                <div 
                                  className={`h-2 w-2 rounded-full ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'}`} 
                                  title={isVideoEnabled ? "Camera on" : "Camera off"}
                                />
                                <span className="text-xs text-slate-400">
                                  {isVideoEnabled ? "Camera on" : "Camera off"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Offline</span>
                          )}
                          
                          {/* Hand raised indicator */}
                          {peerHandRaised && (
                            <div className="flex items-center gap-1.5 text-yellow-400">
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/>
                              </svg>
                              <span className="text-xs font-medium">Hand raised</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {participantsWithEmails.length === 0 && (
                  <p className="text-center py-8 text-sm text-slate-400">No participants</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Chat Modal */}
      {showChat && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowChat(false)}
          />
          
          {/* Modal */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-slate-950/80 backdrop-blur">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Chat</h2>
              <button
                onClick={() => setShowChat(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title="Close"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Messages List */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {chatMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="rounded-lg border border-dashed border-slate-700/80 bg-slate-900/80 px-4 py-3 text-center text-sm text-slate-300">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg: any) => {
                  const isLocalMessage = msg.user_id === user?.id;
                  const avatarColor = getAvatarColor(msg.display_name || "");
                  const initials = getInitials(msg.display_name || "");
                  const timestamp = new Date(msg.created_at);
                  const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${isLocalMessage ? "flex-row-reverse" : ""}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`${avatarColor} flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-md shadow-slate-950/60`}
                      >
                        {initials}
                      </div>
                      
                      {/* Message Content */}
                      <div
                        className={`flex max-w-[75%] ${isLocalMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`rounded-2xl px-3 py-2 ${
                            isLocalMessage
                              ? "bg-blue-600 text-white"
                              : "bg-slate-800 text-slate-100"
                          } shadow-sm shadow-slate-950/60`}
                        >
                          <span className="mb-0.5 block text-[11px] text-slate-200/80">
                            {isLocalMessage ? "You" : msg.display_name} • {timeString}
                          </span>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {/* Scroll anchor */}
              <div ref={chatMessagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="border-t border-slate-700/80 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatMessageInput}
                  onChange={(e) => setChatMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm text-white placeholder-slate-500 shadow-inner shadow-slate-950/60 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  disabled={isSendingMessage || !isConnected}
                />
                <button
                  type="submit"
                  disabled={!chatMessageInput.trim() || isSendingMessage || !isConnected}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-900/40 transition hover:from-sky-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:from-slate-700 disabled:to-slate-700"
                >
                  {isSendingMessage ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
      
      {/* Files Modal */}
      {showFiles && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFiles(false)}
          />
          
          {/* Modal */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-slate-950/80 backdrop-blur">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Files</h2>
              <button
                onClick={() => setShowFiles(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title="Close"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Upload Area */}
            <div className="border-b border-slate-700/80 px-4 py-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading || !isConnected}
              />
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  if (uploading || !isConnected) return;
                  const droppedFile = e.dataTransfer.files[0];
                  if (droppedFile) {
                    // Create a fake event object for handleFileUpload
                    const fakeEvent = {
                      target: {
                        files: [droppedFile],
                      },
                    } as React.ChangeEvent<HTMLInputElement>;
                    handleFileUpload(fakeEvent);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!uploading && isConnected) {
                    setIsDragging(true);
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!uploading && isConnected) {
                    setIsDragging(true);
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Only set dragging to false if we're actually leaving the drop zone
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX;
                  const y = e.clientY;
                  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    setIsDragging(false);
                  }
                }}
                className="w-full"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !isConnected}
                  className={`w-full rounded-xl border-2 border-dashed px-4 py-6 text-sm font-medium text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDragging
                      ? "border-sky-500 bg-sky-900/20"
                      : "border-slate-700 bg-slate-900/60 hover:border-sky-500 hover:bg-slate-900"
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="h-6 w-6 animate-spin text-sky-500"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Uploading... {Math.round(uploadProgress)}%</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="h-6 w-6 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Click to upload or drag and drop</span>
                      <span className="text-xs text-slate-500">Max 10MB</span>
                    </div>
                  )}
                </button>
              </div>
              {uploading && uploadProgress > 0 && (
                <div className="mt-2 w-full rounded-full bg-slate-800/90">
                  <div
                    className="h-1.5 rounded-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            
            {/* Files List */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {files.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="rounded-lg border border-dashed border-slate-700/80 bg-slate-900/80 px-4 py-3 text-center text-sm text-slate-300">
                    No files uploaded yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file: any) => {
                    const isLocalFile = file.user_id === user?.id;
                    const avatarColor = getAvatarColor(file.display_name || "");
                    const initials = getInitials(file.display_name || "");
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
                        className="flex items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-900/70 p-3 shadow-sm shadow-slate-950/60 transition hover:-translate-y-0.5 hover:bg-slate-900"
                      >
                        {/* File Icon */}
                        <div className="flex-shrink-0 text-2xl">
                          {getFileIcon(file.mime_type)}
                        </div>
                        
                        {/* File Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-sm font-semibold text-white"
                                title={file.file_name}
                              >
                                {file.file_name}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs text-slate-400">
                                  {isLocalFile ? "You" : file.display_name}
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
                            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-sky-400"
                            title="Download"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          {isLocalFile && (
                            <button
                              onClick={() => handleFileDelete(file.id)}
                              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                              title="Delete"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer with file count */}
            <div className="border-t border-slate-700/80 px-6 py-3">
              <p className="text-center text-xs text-slate-400">
                {files.length > 0 
                  ? `${files.length} file${files.length === 1 ? '' : 's'}`
                  : 'No files'}
              </p>
            </div>
          </div>
        </>
      )}
      
      {/* Footer */}
      <footer className="bg-slate-950/85 p-2 shadow-inner shadow-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2">
          {toggleError && (
            <div className="rounded-full border border-rose-500/40 bg-rose-500/15 px-4 py-1.5 text-xs text-rose-200 shadow-sm shadow-rose-900/60">
              Error: {toggleError}
            </div>
          )}
          {screenShareError && (
            <div className="rounded-full border border-rose-500/40 bg-rose-500/15 px-4 py-1.5 text-xs text-rose-200 shadow-sm shadow-rose-900/60">
              Screen Share Error: {screenShareError}
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


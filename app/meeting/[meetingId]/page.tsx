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
          
          {/* Status Icons Row - Bottom Overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end bg-gradient-to-t from-black/80 to-transparent p-3">
            {/* Right Side: Mic and Camera Icons */}
            <div className="flex items-center gap-2">
              {/* Mic Icon - Clickable for local user or host */}
              {(isLocal || (isLocalHost && !isLocal)) ? (
                <button
                  onClick={() => {
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
                  onClick={() => {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/70 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">{meeting.title}</h1>
            {meeting.description && (
              <p className="mt-2 text-sm text-slate-300">{meeting.description}</p>
            )}
            {isHost && (
              <p className="mt-2 text-xs text-emerald-400">You are the host</p>
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
              {joining ? "Joining..." : isHost ? "Start Meeting" : "Request to Join"}
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
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{meeting.title}</h1>
            
            {/* Recording Status Indicator - visible to all */}
            {isConnected && isRecording && (
              <div className="flex items-center gap-2 rounded-lg bg-red-600/90 backdrop-blur-sm border border-red-500/50 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/20">
                <div className="relative flex items-center justify-center">
                  <div className="absolute h-3 w-3 rounded-full bg-white animate-ping opacity-75" />
                  <div className="relative h-2.5 w-2.5 rounded-full bg-white" />
                </div>
                <span className="font-semibold">Recording</span>
                {activeRecording?.startedByName && (
                  <span className="text-xs text-red-100 bg-red-700/30 px-2 py-0.5 rounded">
                    by {activeRecording.startedByName}
                  </span>
                )}
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
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  raisedHands.get(localPeer.id) 
                    ? "bg-yellow-500 text-black hover:bg-yellow-400 animate-pulse" 
                    : "bg-slate-700 text-white hover:bg-slate-600"
                }`}
                title={raisedHands.get(localPeer.id) ? "Lower Hand" : "Raise Hand"}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {raisedHands.get(localPeer.id) ? "Lower Hand" : "Raise Hand"}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Recording Controls */}
            {isConnected && canRecord && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm p-1">
                {/* Start/Stop Recording Button */}
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    disabled={isStartingRecording || !canRecord}
                    className={`group relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ${
                      isStartingRecording
                        ? "bg-slate-600/50 cursor-not-allowed opacity-60"
                        : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:scale-105 active:scale-95"
                    }`}
                    title="Start Recording"
                  >
                    <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <circle cx="10" cy="10" r="3.5" fill="currentColor" />
                    </svg>
                    <span>{isStartingRecording ? "Starting..." : "Start Recording"}</span>
                    {!isStartingRecording && (
                      <div className="absolute inset-0 rounded-lg bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    disabled={isStoppingRecording || !canRecord}
                    className={`group relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ${
                      isStoppingRecording
                        ? "bg-slate-600/50 cursor-not-allowed opacity-60"
                        : "bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 shadow-lg shadow-slate-700/30 hover:shadow-slate-600/40 hover:scale-105 active:scale-95 border border-slate-600/50"
                    }`}
                    title="Stop Recording"
                  >
                    <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                      <rect x="6" y="6" width="8" height="8" rx="1.5" fill="currentColor" />
                    </svg>
                    <span>{isStoppingRecording ? "Stopping..." : "Stop Recording"}</span>
                    {!isStoppingRecording && (
                      <div className="absolute inset-0 rounded-lg bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                )}
                
                {/* Permission Toggle Button (Host only) */}
                {isHost && (
                  <button
                    onClick={handleTogglePermission}
                    disabled={isTogglingPermission}
                    className={`group relative flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      allowParticipantsToRecord
                        ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40"
                        : "bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white border border-slate-600/50"
                    } ${isTogglingPermission ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
                    title={allowParticipantsToRecord ? "Disable participant recording" : "Enable participant recording"}
                  >
                    {allowParticipantsToRecord ? (
                      <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">
                      {allowParticipantsToRecord ? "All Can Record" : "Host Only"}
                    </span>
                  </button>
                )}
              </div>
            )}
            
            {isHost && pendingRequests.length > 0 && (
              <button
                onClick={() => setShowHostPanel(!showHostPanel)}
                className="relative rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-400"
              >
                <span className="flex items-center gap-2">
                  Join Requests
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-xs font-bold">
                    {pendingRequests.length}
                  </span>
                </span>
              </button>
            )}
            
            {/* Files Button */}
            <button
              onClick={() => setShowFiles(true)}
              className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Files
              {files.length > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-bold">
                  {files.length}
                </span>
              )}
            </button>
            
            {/* Chat Button */}
            <button
              onClick={() => setShowChat(true)}
              className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              Chat
              {(() => {
                // Count unread messages (messages after last read)
                let unreadCount = 0;
                if (chatMessages.length > 0) {
                  if (!lastReadMessageId) {
                    // No messages read yet - all are unread
                    unreadCount = chatMessages.length;
                  } else {
                    // Find index of last read message
                    const lastReadIndex = chatMessages.findIndex((m: any) => m.id === lastReadMessageId);
                    if (lastReadIndex === -1) {
                      // Last read message not found - all are unread
                      unreadCount = chatMessages.length;
                    } else {
                      // Count messages after last read
                      unreadCount = chatMessages.length - lastReadIndex - 1;
                    }
                  }
                }
                
                // Show badge if there are unread messages when chat is closed
                if (!showChat && unreadCount > 0) {
                  return (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-bold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>
            
            {/* Participants List Button */}
            <button
              onClick={() => setShowParticipantsList(true)}
              className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              Participants
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-600 text-xs font-bold">
                {activeParticipantNames.size > 0 
                  ? activeParticipantNames.size 
                  : peers.length > 0 ? peers.length : 0}
              </span>
            </button>
            
            <button
              onClick={handleLeave}
              className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              Leave Meeting
            </button>
          </div>
        </div>
        {isHost && showHostPanel && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Pending Join Requests</h2>
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
                    className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{request.display_name}</p>
                      <p className="text-xs text-slate-400">
                        Requested {new Date(request.requested_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(request.id, true)}
                        className="rounded-md bg-green-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-400"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproveRequest(request.id, false)}
                        className="rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-400"
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
      <main className="flex-1 p-6">
        <div className="mx-auto h-full max-w-7xl">
          {/* Video Grid */}
          <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Filter out duplicate peers and disconnected peers */}
            {(() => {
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
            })().map((peer) => {
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
              // Multiple ways to identify host:
              // 1. Local peer and current user is host
              // 2. Peer name matches host email (if host used email as display name)
              // 3. Peer name matches stored host display name (if host already joined)
              // 4. Compare peer names more flexibly (case-insensitive, partial match)
              const isPeerHost = 
                (peer.id === localPeer?.id && user?.id === meeting.host_id) || // Local peer is host
                (meeting.host_email && peer.name?.toLowerCase() === meeting.host_email.toLowerCase()) || // Remote peer name matches host email
                (hostDisplayName && peer.name?.toLowerCase() === hostDisplayName.toLowerCase()) || // Remote peer name matches host display name
                (meeting.host_email && peer.name?.toLowerCase().includes(meeting.host_email.split("@")[0]?.toLowerCase() || "")) || // Partial match with host email username
                (hostDisplayName && peer.name?.toLowerCase().includes(hostDisplayName.toLowerCase())); // Partial match with host display name
              
              // Check if current user is host (for remote controls)
              const currentUserIsHost = user?.id === meeting.host_id;
              
              return (
                <div
                  key={peer.id}
                  className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-lg"
                >
                  <VideoTile 
                    track={videoTrack} 
                    peer={peer} 
                    localPeerId={localPeer?.id}
                    isHost={isPeerHost}
                    isLocalHost={currentUserIsHost}
                    audioTrack={audioTrack}
                    onToggleAudio={peer.id === localPeer?.id ? handleToggleAudio : undefined}
                    onToggleVideo={peer.id === localPeer?.id ? handleToggleVideo : undefined}
                    onToggleRemoteAudio={currentUserIsHost && peer.id !== localPeer?.id ? handleToggleRemoteAudio : undefined}
                    onToggleRemoteVideo={currentUserIsHost && peer.id !== localPeer?.id ? handleToggleRemoteVideo : undefined}
                    isHandRaised={raisedHands.get(peer.id) || false}
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
      
      {/* Participants List Modal */}
      {showParticipantsList && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowParticipantsList(false)}
          />
          
          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-slate-800 shadow-2xl border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Participants</h2>
              <button
                onClick={() => setShowParticipantsList(false)}
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
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
                      className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition hover:bg-slate-900"
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
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowChat(false)}
          />
          
          {/* Modal */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-slate-800 shadow-2xl border-l border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Chat</h2>
              <button
                onClick={() => setShowChat(false)}
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                title="Close"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Messages List */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-center text-slate-400">No messages yet. Start the conversation!</p>
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
                          <span className="text-xs text-slate-400">{timeString}</span>
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
                })
              )}
              {/* Scroll anchor */}
              <div ref={chatMessagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="border-t border-slate-700 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatMessageInput}
                  onChange={(e) => setChatMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSendingMessage || !isConnected}
                />
                <button
                  type="submit"
                  disabled={!chatMessageInput.trim() || isSendingMessage || !isConnected}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed"
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
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFiles(false)}
          />
          
          {/* Modal */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-slate-800 shadow-2xl border-l border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Files</h2>
              <button
                onClick={() => setShowFiles(false)}
                className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                title="Close"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {/* Upload Area */}
            <div className="border-b border-slate-700 px-4 py-4">
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
                  className={`w-full rounded-md border-2 border-dashed px-4 py-6 text-sm font-medium text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-slate-600 bg-slate-900/50 hover:border-blue-500 hover:bg-slate-900'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Uploading... {Math.round(uploadProgress)}%</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Click to upload or drag and drop</span>
                      <span className="text-xs text-slate-500">Max 10MB</span>
                    </div>
                  )}
                </button>
              </div>
              {uploading && uploadProgress > 0 && (
                <div className="mt-2 w-full rounded-full bg-slate-700">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            
            {/* Files List */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {files.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-center text-slate-400">No files uploaded yet.</p>
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
                          {isLocalFile && (
                            <button
                              onClick={() => handleFileDelete(file.id)}
                              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-700 hover:text-rose-400"
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
            <div className="border-t border-slate-700 px-6 py-3">
              <p className="text-xs text-slate-400 text-center">
                {files.length > 0 
                  ? `${files.length} file${files.length === 1 ? '' : 's'}`
                  : 'No files'}
              </p>
            </div>
          </div>
        </>
      )}
      
      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/70 p-2">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2">
          {toggleError && (
            <div className="rounded-md bg-rose-500/20 px-4 py-2 text-sm text-rose-300">
              Error: {toggleError}
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


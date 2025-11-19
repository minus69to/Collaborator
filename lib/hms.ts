import { SDK } from "@100mslive/server-sdk";
import { getServerEnv } from "./validateEnv";

const { HMS_ACCOUNT_ID, HMS_SECRET } = getServerEnv();

function buildRecordingMeetingUrl(roomId: string): string | null {
  const baseUrl = process.env.HMS_RECORDING_MEETING_URL?.trim();
  const templateId = process.env.HMS_TEMPLATE_ID?.trim();

  if (!baseUrl) {
    console.warn(
      "[Recording] HMS_RECORDING_MEETING_URL not configured. Composite recordings might miss video unless a meeting URL is provided."
    );
    return null;
  }

  try {
    const normalizedBase = baseUrl.replace(/\/$/, "");
    const url = new URL(`${normalizedBase}/${roomId}`);

    const params = url.searchParams;
    if (!params.has("skip_preview")) params.set("skip_preview", "true");
    if (!params.has("ui_mode")) params.set("ui_mode", "recorder");
    params.set("auto_join", "true");
    if (templateId && !params.has("template_id")) {
      params.set("template_id", templateId);
    }

    return url.toString();
  } catch (error) {
    console.error("[Recording] Invalid HMS_RECORDING_MEETING_URL. Expected a full https URL.", error);
    return null;
  }
}

// Initialize 100ms SDK - constructor takes accessKey and secret as positional arguments
// Trim values to avoid whitespace issues from env file
const hms = new SDK(HMS_ACCOUNT_ID.trim(), HMS_SECRET.trim());

interface HMSRoom {
  id: string;
  name: string;
  description?: string;
}

/**
 * Create a new 100ms room.
 */
export async function createHMSRoom(name: string, description?: string): Promise<HMSRoom> {
  try {
    const room = await hms.rooms.create({
      name,
      description,
    });

    return {
      id: room.id,
      name: room.name,
      description: room.description,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to create 100ms room: ${errorMessage}`);
  }
}

/**
 * Generate an authentication token for a user to join a 100ms room.
 */
export async function generateHMSToken(
  roomId: string,
  userId: string,
  role: string = "broadcaster"
): Promise<string> {
  try {
    const authToken = await hms.auth.getAuthToken({
      roomId,
      role,
      userId,
    });

    return authToken.token;
  } catch (error: unknown) {
    // Enhanced error logging
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    console.error("100ms token generation error:", {
      roomId,
      role,
      userId,
      error: errorMessage,
    });
    throw new Error(`Failed to generate 100ms token for role "${role}": ${errorMessage}`);
  }
}

/**
 * Get room details from 100ms.
 */
export async function getHMSRoom(roomId: string): Promise<HMSRoom | null> {
  try {
    const room = await hms.rooms.retrieveById(roomId);
    return {
      id: room.id,
      name: room.name,
      description: room.description,
    };
  } catch {
    return null;
  }
}

/**
 * List recordings for a 100ms room.
 */
export async function listHMSRecordings(roomId: string) {
  try {
    // Primary approach: SDK
    try {
      // The SDK may return an iterable, so we need to convert it to an array
      const recordingsIterable = hms.recordings.list({
        room_id: roomId,
      });
      
      const recordingsArray: any[] = [];
      if (Array.isArray(recordingsIterable)) {
        recordingsArray.push(...recordingsIterable);
      } else {
        for await (const recording of recordingsIterable as AsyncIterable<any>) {
          recordingsArray.push(recording);
        }
      }
      
      return recordingsArray.map((rec: any) => ({
        id: rec.id,
        roomId: rec.room_id || roomId,
        status: rec.status,
        url: rec.url || null,
        startedAt: rec.started_at || null,
        stoppedAt: rec.stopped_at || null,
      }));
    } catch (sdkError) {
      // If SDK call fails due to permission (403) or any reason, fallback to REST with management token
      const message = sdkError instanceof Error ? sdkError.message : JSON.stringify(sdkError);
      if (!message.includes("403") && !message.toLowerCase().includes("forbidden")) {
        throw sdkError;
      }
      // REST fallback
      const managementToken = await generateManagementToken();
      if (!managementToken) {
        throw new Error("Failed to generate management token for listing recordings");
      }
      const baseUrl = "https://api.100ms.live/v2";
      const url = `${baseUrl}/recordings?room_id=${encodeURIComponent(roomId)}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`REST list recordings failed: ${resp.status} ${text}`);
      }
      const data = await resp.json();
      const items = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      return items.map((rec: any) => ({
        id: rec.id,
        roomId: rec.room_id || roomId,
        status: rec.status,
        url: rec.url || null,
        startedAt: rec.started_at || null,
        stoppedAt: rec.stopped_at || null,
      }));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Failed to list 100ms recordings:", errorMessage);
    throw new Error(`Failed to list recordings: ${errorMessage}`);
  }
}

/**
 * Check if there's an active recording for a room.
 */
export async function hasActiveRecording(roomId: string): Promise<boolean> {
  try {
    const recordings = await listHMSRecordings(roomId);
    // Check if there's any recording with status 'running' or 'recording' or 'starting'
    return recordings.some((rec: any) => 
      rec.status === 'running' || 
      rec.status === 'recording' || 
      rec.status === 'starting'
    );
  } catch (error) {
    console.error("Failed to check active recording:", error);
    // If we can't check, assume there's no active recording to allow starting
    return false;
  }
}

/**
 * Start recording for a 100ms room.
 */
type HMSRecordingStartParams = {
  resolution?: {
    width: number;
    height: number;
  };
  audio_only?: boolean;
  meeting_url?: string;
};

export async function startHMSRecording(roomId: string) {
  try {
    // Validate roomId is a non-empty string
    if (!roomId || typeof roomId !== 'string') {
      throw new Error(`Invalid roomId: expected non-empty string, got ${typeof roomId}: ${roomId}`);
    }
    
    // Check if there's already an active recording (optional - 100ms might handle this)
    // We'll let 100ms handle duplicates, but log a warning
    const hasActive = await hasActiveRecording(roomId);
    if (hasActive) {
      console.warn(`Warning: Active recording may already exist for room ${roomId}`);
    }
    
    // Using 100ms SDK to start recording with explicit composite video settings
    const meetingUrl = buildRecordingMeetingUrl(roomId);

    const startParams: HMSRecordingStartParams = {
      audio_only: false,
      resolution: {
        width: 1920,
        height: 1080,
      },
    };

    if (meetingUrl) {
      startParams.meeting_url = meetingUrl;
    }

    const response = await (hms.recordings as any).start(roomId, startParams);

    return {
      id: response.id || response.recording_id || response.session_id || response.room_id,
      roomId: response.room_id || roomId,
      status: response.status || 'recording',
      url: response.url || null,
      startedAt: response.started_at || new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Failed to start 100ms recording:", errorMessage);
    
    // Provide more helpful error messages
    if (errorMessage.includes('already') || errorMessage.includes('running')) {
      throw new Error(`Recording is already running for this room: ${errorMessage}`);
    }
    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
      throw new Error(`Permission denied: Recording may not be enabled for this account: ${errorMessage}`);
    }
    
    throw new Error(`Failed to start recording: ${errorMessage}`);
  }
}

/**
 * Stop recording for a 100ms room.
 * @param recordingId - The recording ID (required for stopping a specific recording)
 * @param roomId - The room ID (used only if recordingId is null/undefined, uses stopAll)
 */
export async function stopHMSRecording(recordingId: string | null, roomId?: string | null) {
  try {
    // If recordingId is provided and is a non-empty string, stop that specific recording
    if (recordingId && typeof recordingId === 'string' && recordingId.trim().length > 0) {
      const response = await hms.recordings.stop(recordingId);
      return {
        id: recordingId,
        roomId: response.room_id || roomId || null,
        status: response.status || 'stopped',
        stoppedAt: response.stopped_at || new Date().toISOString(),
      };
    }
    
    // If only roomId provided (recordingId is null/empty), stop all recordings for that room
    if (roomId && typeof roomId === 'string' && roomId.trim().length > 0) {
      // First check if there are any active recordings
      const hasActive = await hasActiveRecording(roomId);
      if (!hasActive) {
        throw new Error('No active recordings found for this room');
      }
      
      const response = await hms.recordings.stopAll(roomId);
      return {
        id: null,
        roomId: roomId,
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
      };
    }
    
    throw new Error('Either recordingId or roomId must be provided');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Failed to stop 100ms recording:", errorMessage);
    
    // Provide more helpful error messages
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw new Error(`Recording not found: The recording may have already been stopped or does not exist: ${errorMessage}`);
    }
    if (errorMessage.includes('No active recordings')) {
      throw new Error(errorMessage);
    }
    
    throw new Error(`Failed to stop recording: ${errorMessage}`);
  }
}

/**
 * Get recording details from 100ms.
 */
export async function getHMSRecording(recordingId: string) {
  try {
    // Get recording by ID
    const recording = await hms.recordings.retrieve(recordingId);
    const recordingAny = recording as any;
    
    // 100ms returns meeting_url (preview URL) and recording_assets array
    // Find the video asset - prioritize video over audio-only
    const recordingAssets: any[] = Array.isArray(recordingAny.recording_assets) ? recordingAny.recording_assets : [];
    
    console.log(`[getHMSRecording] Found ${recordingAssets.length} assets for recording ${recordingId}:`, 
      recordingAssets.map((a: any) => ({ 
        id: a.id, 
        type: a.type, 
        status: a.status,
        path: a.path || a.file_path || a.s3_path || a.gcs_path || a.storage_path || 'N/A',
        name: a.name || a.file_name || 'N/A',
        hasUrl: !!(a.download_url || a.url || a.presigned_url)
      }))
    );
    
    // Helper function to check if an asset is likely a final video (not intermediate/audio)
    const isFinalVideoAsset = (asset: any): boolean => {
      const path = (asset.path || asset.file_path || asset.s3_path || asset.gcs_path || asset.storage_path || '').toLowerCase();
      const name = (asset.name || asset.file_name || '').toLowerCase();
      
      // Exclude intermediate/beam assets (these are often audio-only or processing files)
      if (path.includes('/intermediates/') || path.includes('/beam/')) {
        return false;
      }
      
      // Exclude assets explicitly named as audio
      if (name.includes('rec-audio') || name.includes('audio-only')) {
        return false;
      }
      
      // Prefer assets in room-composite folder or with video indicators
      if (path.includes('/room-composite/') || name.includes('composite') || name.includes('video')) {
        return true;
      }
      
      // If it's room-composite type and not in intermediates, it's likely final
      if (asset.type === 'room-composite' && !path.includes('/intermediates/')) {
        return true;
      }
      
      return false;
    };
    
    // Prioritize video assets: look for final room-composite (video) first
    let videoAsset: any | null = null;
    
    // First try: room-composite with completed status that's a final video (not intermediate)
    videoAsset = recordingAssets.find((asset: any) => 
      asset?.type === "room-composite" && 
      asset?.status === "completed" &&
      isFinalVideoAsset(asset)
    ) || null;
    
    // Second try: any room-composite that's a final video (even if not completed yet)
    if (!videoAsset) {
      videoAsset = recordingAssets.find((asset: any) => 
        asset?.type === "room-composite" && isFinalVideoAsset(asset)
      ) || null;
    }
    
    // Third try: room-composite with completed status (even if intermediate, but prefer non-intermediate)
    if (!videoAsset) {
      videoAsset = recordingAssets.find((asset: any) => 
        asset?.type === "room-composite" && asset?.status === "completed"
      ) || null;
    }
    
    // Fourth try: any room-composite (even if not completed yet)
    if (!videoAsset) {
      videoAsset = recordingAssets.find((asset: any) => asset?.type === "room-composite") || null;
    }
    
    // Fifth try: any asset that's not audio-only and is a final video
    if (!videoAsset) {
      videoAsset = recordingAssets.find((asset: any) => 
        asset?.type !== "audio-only" && 
        asset?.status === "completed" &&
        isFinalVideoAsset(asset)
      ) || null;
    }
    
    // Sixth try: any asset that's not audio-only
    if (!videoAsset) {
      videoAsset = recordingAssets.find((asset: any) => 
        asset?.type !== "audio-only" && asset?.status === "completed"
      ) || null;
    }
    
    // Seventh try: any non-audio asset
    if (!videoAsset) {
      videoAsset = recordingAssets.find((asset: any) => asset?.type !== "audio-only") || null;
    }
    
    // Last resort: use the first completed asset
    if (!videoAsset) {
      videoAsset = recordingAssets.find((asset: any) => asset?.status === "completed") || null;
    }
    
    // Final fallback: use the first asset
    if (!videoAsset && recordingAssets.length > 0) {
      videoAsset = recordingAssets[0];
    }
    
    if (videoAsset) {
      const assetPath = videoAsset.path || videoAsset.file_path || videoAsset.s3_path || videoAsset.gcs_path || videoAsset.storage_path || 'N/A';
      const assetName = videoAsset.name || videoAsset.file_name || 'N/A';
      console.log(`[getHMSRecording] Selected asset:`, {
        id: videoAsset.id,
        type: videoAsset.type,
        status: videoAsset.status,
        path: assetPath,
        name: assetName,
        isFinalVideo: isFinalVideoAsset(videoAsset),
      });
    } else {
      console.log(`[getHMSRecording] No video asset found in ${recordingAssets.length} assets`);
    }
    
    // Try to get download URL from asset if available
    let downloadUrl: string | null = null;
    if (videoAsset?.id) {
      try {
        // Try to get asset download URL via REST API
        // Note: The SDK might not have this method, so we may need to use REST API directly
        // For now, we'll check if there's a download_url in the asset
        downloadUrl = videoAsset.download_url || videoAsset.url || videoAsset.presigned_url || null;
      } catch (e) {
        // Asset download URL not available via SDK
      }
    }
    
    // Use download URL from asset, or fallback to meeting_url (preview URL)
    const url = downloadUrl ||
                recordingAny.meeting_url ||
                recordingAny.url || 
                recordingAny.recording_url || 
                recordingAny.recordingUrl ||
                recordingAny.video_url ||
                recordingAny.videoUrl ||
                null;
    
    // Get duration and file size from the video asset if available
    const duration = videoAsset?.duration || recordingAny.duration || null;
    const fileSize = videoAsset?.size || recordingAny.file_size || recordingAny.fileSize || null;
    
    // Extract file path from asset (for custom storage)
    // The path might be in different fields depending on storage provider
    const filePath = videoAsset?.path || 
                     videoAsset?.file_path || 
                     videoAsset?.s3_path ||
                     videoAsset?.gcs_path ||
                     videoAsset?.storage_path ||
                     null;
    
    return {
      id: recording.id,
      roomId: recordingAny.room_id || recordingAny.roomId,
      status: recordingAny.status,
      url: url,
      assetId: videoAsset?.id || null,
      filePath: filePath,
      startedAt: recordingAny.started_at || recordingAny.start_time || recordingAny.startedAt || recordingAny.startTime || null,
      stoppedAt: recordingAny.stopped_at || recordingAny.end_time || recordingAny.stoppedAt || recordingAny.endTime || null,
      duration: duration,
      fileSize: fileSize,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to get recording: ${errorMessage}`);
  }
}

/**
 * Get raw recording assets for a given recording.
 */
export async function getHMSRecordingAssets(recordingId: string): Promise<any[]> {
  try {
    const recording = await hms.recordings.retrieve(recordingId);
    return Array.isArray(recording.recording_assets) ? recording.recording_assets : [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to get recording assets: ${errorMessage}`);
  }
}

/**
 * Generate a management token for 100ms Management API.
 * Uses the SDK's built-in method which handles JWT generation correctly.
 */
async function generateManagementToken(): Promise<string | null> {
  try {
    // Use the SDK's built-in method - it handles JWT generation correctly
    // including jti (JWT ID) and all required fields
    const managementToken = await hms.auth.getManagementToken();
    console.log(`[Management Token] Generated via SDK`);
    return managementToken.token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[Management Token] Failed to generate token via SDK:`, errorMessage);
    return null;
  }
}

/**
 * Get download URL for a recording asset from 100ms using Management API.
 * Uses the 100ms REST API to get a pre-signed download URL from their storage.
 * Note: This requires the asset_id from the recording_assets array.
 */
export async function getHMSRecordingAssetDownloadUrl(assetId: string): Promise<string | null> {
  try {
    const { HMS_ACCOUNT_ID, HMS_SECRET } = getServerEnv();
    const baseUrl = "https://api.100ms.live/v2";
    const basicAuth = Buffer.from(`${HMS_ACCOUNT_ID.trim()}:${HMS_SECRET.trim()}`).toString("base64");
    
    // 100ms Management API requires Bearer token authentication
    // First, try to get pre-signed URL directly (this is the recommended endpoint)
    // According to 100ms docs, the endpoint is: /v2/recording-assets/{asset_id}/presigned-url
    
    console.log(`[Asset Download URL] Fetching pre-signed URL for asset ${assetId} from 100ms Management API...`);
    
    // Generate management token (JWT Bearer token)
    const managementToken = await generateManagementToken();
    
    if (!managementToken) {
      console.error(`[Asset Download URL] Failed to generate management token`);
      return null;
    }
    
    // Try the pre-signed URL endpoint with proper Bearer token
    try {
      const presignedResponse = await fetch(`${baseUrl}/recording-assets/${assetId}/presigned-url`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (presignedResponse.ok) {
        const presignedData = await presignedResponse.json();
        const downloadUrl = presignedData.url || presignedData.presigned_url || null;
        if (downloadUrl) {
          console.log(`[Asset Download URL] ✓ Got pre-signed URL from presigned-url endpoint`);
          return downloadUrl;
        }
      } else {
        const errorText = await presignedResponse.text();
        console.log(`[Asset Download URL] Presigned URL endpoint failed: ${presignedResponse.status}`, errorText.substring(0, 200));
      }
    } catch (presignedError) {
      console.log(`[Asset Download URL] Presigned URL endpoint error:`, presignedError);
    }
    
    // Fallback: Try Basic Auth on presigned-url endpoint
    try {
      const presignedResponse = await fetch(`${baseUrl}/recording-assets/${assetId}/presigned-url`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (presignedResponse.ok) {
        const presignedData = await presignedResponse.json();
        const downloadUrl = presignedData.url || presignedData.presigned_url || null;
        if (downloadUrl) {
          console.log(`[Asset Download URL] ✓ Got pre-signed URL using Basic Auth`);
          return downloadUrl;
        }
      }
    } catch (basicError) {
      console.log(`[Asset Download URL] Basic Auth also failed`);
    }
    
    // Fallback: Try to get asset details first, then extract URL
    try {
      const assetResponse = await fetch(`${baseUrl}/recording-assets/${assetId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (assetResponse.ok) {
        const assetData = await assetResponse.json();
        console.log(`[Asset Download URL] Asset response keys:`, Object.keys(assetData));
        
        const downloadUrl = assetData.download_url || 
                           assetData.presigned_url || 
                           assetData.presigned_download_url ||
                           assetData.url || 
                           assetData.recording_url || 
                           null;
        
        if (downloadUrl) {
          console.log(`[Asset Download URL] ✓ Got download URL from asset details`);
          return downloadUrl;
        }
      } else {
        const errorText = await assetResponse.text();
        console.log(`[Asset Download URL] Asset details endpoint failed: ${assetResponse.status}`, errorText.substring(0, 200));
      }
    } catch (assetError) {
      console.log(`[Asset Download URL] Failed to get asset details:`, assetError);
    }
    
    console.log(`[Asset Download URL] ✗ All methods failed - could not get download URL`);
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[Asset Download URL] Exception: ${errorMessage}`);
    return null;
  }
}

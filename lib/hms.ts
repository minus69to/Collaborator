import { SDK } from "@100mslive/server-sdk";
import { getServerEnv } from "./validateEnv";

const { HMS_ACCOUNT_ID, HMS_SECRET } = getServerEnv();

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
    // List all recordings for a room
    // The SDK may return an iterable, so we need to convert it to an array
    const recordingsIterable = hms.recordings.list({
      room_id: roomId,
    });
    
    // Convert iterable to array
    const recordingsArray: any[] = [];
    if (Array.isArray(recordingsIterable)) {
      recordingsArray.push(...recordingsIterable);
    } else {
      // Handle async iterable
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
    return recordings.some(rec => 
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
    
    // Using 100ms SDK to start recording
    // The recordings.start() method takes roomId as a string parameter
    const response = await hms.recordings.start(roomId);

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
    return {
      id: recording.id,
      roomId: recording.room_id,
      status: recording.status,
      url: recording.url || recording.recording_url || null,
      startedAt: recording.started_at || recording.start_time || null,
      stoppedAt: recording.stopped_at || recording.end_time || null,
      duration: recording.duration || null,
      fileSize: recording.file_size || null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to get recording: ${errorMessage}`);
  }
}

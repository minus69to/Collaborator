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

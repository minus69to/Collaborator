import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { getHMSRecording } from "@/lib/hms";

/**
 * GET endpoint to retrieve recording details by recording ID
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const recordingId = searchParams.get("recordingId");

    if (!recordingId) {
      throw badRequest("recordingId is required");
    }

    // Get recording details from 100ms
    try {
      const recording = await getHMSRecording(recordingId);

      return Response.json({
        ok: true,
        message: "Recording details retrieved successfully",
        recording: {
          id: recording.id,
          roomId: recording.roomId,
          status: recording.status,
          url: recording.url,
          startedAt: recording.startedAt,
          stoppedAt: recording.stoppedAt,
          duration: recording.duration,
          fileSize: recording.fileSize,
        },
      });
    } catch (recordingError) {
      // Handle recording-specific errors with more detail
      const errorMessage = recordingError instanceof Error ? recordingError.message : String(recordingError);
      console.error("Failed to get recording:", recordingId, errorMessage);
      
      return Response.json({
        ok: false,
        error: `Failed to retrieve recording: ${errorMessage}`,
        recordingId,
        details: recordingError,
      }, { status: 400 });
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}


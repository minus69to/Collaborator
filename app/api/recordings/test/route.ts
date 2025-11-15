import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { getHMSRoom, startHMSRecording, stopHMSRecording, listHMSRecordings, hasActiveRecording } from "@/lib/hms";

// Test recording functionality
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = (await request.json()) as {
      meetingId?: string;
      roomId?: string;
      recordingId?: string;
      action: "start" | "stop" | "check";
    };

    if (!body.action) {
      throw badRequest("action is required (start, stop, or check)");
    }

    const supabase = createSupabaseServiceRoleClient();
    let hmsRoomId: string | null = null;

    // For stop action with recordingId, we don't need roomId
    // For other actions (start, check), we need roomId
    const needsRoomId = body.action !== "stop" || !body.recordingId;

    if (needsRoomId) {
      // Get room ID from meeting if meetingId provided
      if (body.meetingId) {
        const { data: meeting, error: meetingError } = await supabase
          .from("meetings")
          .select("hms_room_id")
          .eq("id", body.meetingId)
          .single();

        if (meetingError || !meeting) {
          throw badRequest("Meeting not found");
        }

        if (!meeting.hms_room_id) {
          throw badRequest("Meeting does not have an HMS room ID");
        }

        hmsRoomId = meeting.hms_room_id;
      } else if (body.roomId) {
        hmsRoomId = body.roomId;
      } else {
        throw badRequest("meetingId or roomId is required");
      }

      // Verify room exists in 100ms
      const room = await getHMSRoom(hmsRoomId);
      if (!room) {
        throw badRequest("HMS room not found");
      }
    }

    // Test based on action
    if (body.action === "check") {
      return Response.json({
        ok: true,
        message: "Room exists and recording can be tested",
        roomId: hmsRoomId,
        room: {
          id: room.id,
          name: room.name,
        },
      });
    } else if (body.action === "start") {
      try {
        // Ensure hmsRoomId is a string before passing to SDK
        if (!hmsRoomId || typeof hmsRoomId !== 'string') {
          throw badRequest(`Invalid roomId: expected string, got ${typeof hmsRoomId}`);
        }
        
        // Check for existing recordings (optional - for better error messages)
        // Note: We'll let 100ms handle duplicates, but we can warn if one exists
        try {
          const hasActive = await hasActiveRecording(hmsRoomId);
          if (hasActive) {
            const recordings = await listHMSRecordings(hmsRoomId);
            const activeRecordings = recordings.filter(r => 
              r.status === 'running' || r.status === 'recording' || r.status === 'starting'
            );
            console.warn(`Warning: Active recording(s) found for room ${hmsRoomId}:`, activeRecordings.map(r => r.id));
            // Continue anyway - 100ms will handle duplicates or reject if needed
          }
        } catch (checkError) {
          // If we can't check, proceed anyway - 100ms will handle duplicates
          console.warn("Could not check for active recordings:", checkError);
        }
        
        const recording = await startHMSRecording(hmsRoomId);
        return Response.json({
          ok: true,
          message: "Recording started successfully",
          recording,
        });
      } catch (recordingError) {
        return Response.json({
          ok: false,
          error: recordingError instanceof Error ? recordingError.message : "Failed to start recording",
          details: recordingError,
        }, { status: 400 });
      }
    } else if (body.action === "stop") {
      try {
        // Stop recording - prefer recordingId if provided, otherwise use roomId with stopAll
        const recordingId = body.recordingId || null;
        
        if (recordingId) {
          // Stop specific recording by ID
          const result = await stopHMSRecording(recordingId, null);
          return Response.json({
            ok: true,
            message: "Recording stopped successfully",
            result,
          });
        } else if (hmsRoomId) {
          // Stop all recordings for the room (pass null as recordingId to use stopAll)
          const result = await stopHMSRecording(null, hmsRoomId);
          return Response.json({
            ok: true,
            message: "All recordings stopped successfully",
            result,
          });
        } else {
          throw badRequest("recordingId or roomId/meetingId is required to stop recording");
        }
      } catch (recordingError) {
        return Response.json({
          ok: false,
          error: recordingError instanceof Error ? recordingError.message : "Failed to stop recording",
          details: recordingError,
        }, { status: 400 });
      }
    }

    throw badRequest("Invalid action");
  } catch (error) {
    return toErrorResponse(error);
  }
}

// GET endpoint to check room status
export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");
    const roomId = searchParams.get("roomId");

    if (!meetingId && !roomId) {
      throw badRequest("meetingId or roomId is required");
    }

    const supabase = createSupabaseServiceRoleClient();
    let hmsRoomId: string | null = null;

    if (meetingId) {
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("hms_room_id")
        .eq("id", meetingId)
        .single();

      if (meetingError || !meeting) {
        throw badRequest("Meeting not found");
      }

      if (!meeting.hms_room_id) {
        throw badRequest("Meeting does not have an HMS room ID");
      }

      hmsRoomId = meeting.hms_room_id;
    } else {
      hmsRoomId = roomId;
    }

    // Verify room exists
    const room = await getHMSRoom(hmsRoomId!);

    return Response.json({
      ok: true,
      roomId: hmsRoomId,
      room: room || null,
      canTestRecording: !!room,
    });

  } catch (error) {
    return toErrorResponse(error);
  }
}


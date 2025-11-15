import { NextRequest } from "next/server";
import { badRequest, forbidden, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { stopHMSRecording, getHMSRecording } from "@/lib/hms";

/**
 * Stop recording for a meeting.
 * - Host can always stop recording
 * - Participants can stop if allow_participants_to_record is true
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { meetingId: string; recordingId?: string };

    if (!body.meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, host_id, hms_room_id, allow_participants_to_record")
      .eq("id", body.meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    if (!meeting.hms_room_id) {
      throw badRequest("Meeting does not have an HMS room ID");
    }

    // Check permissions: host can always stop, participants only if allowed
    const isHost = meeting.host_id === user.id;
    const canRecord = isHost || meeting.allow_participants_to_record === true;

    if (!canRecord) {
      throw forbidden("You do not have permission to stop recording. Only the host can stop recording.");
    }

    // Find active recording for this meeting
    let hmsRecordingId: string | null = null;

    if (body.recordingId) {
      // If recordingId provided, verify it belongs to this meeting
      const { data: recordingRecord } = await supabase
        .from("meeting_recordings")
        .select("hms_recording_id, status")
        .eq("id", body.recordingId)
        .eq("meeting_id", body.meetingId)
        .in("status", ["starting", "recording", "running"])
        .single();

      if (recordingRecord) {
        hmsRecordingId = recordingRecord.hms_recording_id;
      }
    } else {
      // Find active recording for this meeting
      const { data: activeRecording } = await supabase
        .from("meeting_recordings")
        .select("id, hms_recording_id")
        .eq("meeting_id", body.meetingId)
        .in("status", ["starting", "recording", "running"])
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (activeRecording) {
        hmsRecordingId = activeRecording.hms_recording_id;
      }
    }

    if (!hmsRecordingId) {
      throw badRequest("No active recording found for this meeting");
    }

    // Stop recording via 100ms
    const result = await stopHMSRecording(hmsRecordingId, null);

    // Update recording in database
    const { error: updateError } = await supabase
      .from("meeting_recordings")
      .update({
        status: "stopped",
        stopped_at: result.stoppedAt || new Date().toISOString(),
        stopped_by: user.id,
        auto_stopped: false,
        updated_at: new Date().toISOString(),
      })
      .eq("meeting_id", body.meetingId)
      .eq("hms_recording_id", hmsRecordingId)
      .in("status", ["starting", "recording", "running"]);

    if (updateError) {
      console.error("Failed to update recording in database:", updateError);
      // Still return success since recording stopped in 100ms
    }

    return Response.json({
      ok: true,
      message: "Recording stopped successfully",
      recording: {
        hmsRecordingId: result.id,
        status: result.status,
        stoppedAt: result.stoppedAt,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


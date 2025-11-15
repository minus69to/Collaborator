import { NextRequest } from "next/server";
import { badRequest, forbidden, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { getHMSRoom, startHMSRecording, hasActiveRecording } from "@/lib/hms";

/**
 * Start recording for a meeting.
 * - Host can always start recording
 * - Participants can start if allow_participants_to_record is true
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { meetingId: string };

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

    // Check permissions: host can always record, participants only if allowed
    const isHost = meeting.host_id === user.id;
    const canRecord = isHost || meeting.allow_participants_to_record === true;

    if (!canRecord) {
      throw forbidden("You do not have permission to start recording. Only the host can start recording.");
    }

    // Check if there's already an active recording
    const hasActive = await hasActiveRecording(meeting.hms_room_id);
    if (hasActive) {
      throw badRequest("A recording is already in progress for this meeting");
    }

    // Get user's display name
    const { data: participant } = await supabase
      .from("meeting_participants")
      .select("display_name")
      .eq("meeting_id", body.meetingId)
      .eq("user_id", user.id)
      .is("left_at", null)
      .single();

    const displayName = participant?.display_name || user.email?.split("@")[0] || "Unknown";

    // Start recording via 100ms
    const recording = await startHMSRecording(meeting.hms_room_id);

    // Store recording in database
    const { data: recordingRecord, error: insertError } = await supabase
      .from("meeting_recordings")
      .insert({
        meeting_id: body.meetingId,
        hms_recording_id: recording.id,
        started_by: user.id,
        display_name: displayName,
        status: recording.status || "starting",
        started_at: recording.startedAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store recording in database:", insertError);
      // Still return success since recording started in 100ms
    }

    return Response.json({
      ok: true,
      message: "Recording started successfully",
      recording: {
        id: recordingRecord?.id || null,
        hmsRecordingId: recording.id,
        status: recording.status,
        startedAt: recording.startedAt,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


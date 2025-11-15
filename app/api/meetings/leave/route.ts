import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { stopHMSRecording } from "@/lib/hms";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { meetingId: string };

    if (!body.meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Update participant's left_at timestamp
    const { error: updateError } = await supabase
      .from("meeting_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("meeting_id", body.meetingId)
      .eq("user_id", user.id)
      .is("left_at", null);

    if (updateError) {
      console.error("Error updating participant left_at:", updateError);
      // Don't throw - we still want to check for meeting end
    }

    // Check if there are any active participants left
    const { data: activeParticipants, error: checkError } = await supabase
      .from("meeting_participants")
      .select("id")
      .eq("meeting_id", body.meetingId)
      .is("left_at", null);

    if (checkError) {
      console.error("Error checking active participants:", checkError);
      // Return success even if check fails
      return Response.json({ ok: true });
    }

    // If no active participants, end the meeting
    if (!activeParticipants || activeParticipants.length === 0) {
      // Stop any active recordings before ending the meeting
      try {
        const { data: activeRecordings } = await supabase
          .from("meeting_recordings")
          .select("hms_recording_id, id")
          .eq("meeting_id", body.meetingId)
          .in("status", ["starting", "recording", "running"]);

        if (activeRecordings && activeRecordings.length > 0) {
          // Stop all active recordings
          for (const recording of activeRecordings) {
            try {
              await stopHMSRecording(recording.hms_recording_id, null);
              // Update recording as auto-stopped
              await supabase
                .from("meeting_recordings")
                .update({
                  status: "stopped",
                  stopped_at: new Date().toISOString(),
                  auto_stopped: true,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", recording.id);
            } catch (stopError) {
              console.error(`Failed to auto-stop recording ${recording.id}:`, stopError);
              // Continue with other recordings even if one fails
            }
          }
        }
      } catch (recordingError) {
        console.error("Error stopping recordings on meeting end:", recordingError);
        // Continue with meeting end even if recording stop fails
      }

      // End the meeting
      await supabase
        .from("meetings")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", body.meetingId);
    }

    return Response.json({
      ok: true,
      meetingEnded: !activeParticipants || activeParticipants.length === 0,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


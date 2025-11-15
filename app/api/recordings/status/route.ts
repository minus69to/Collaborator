import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

/**
 * Get recording status and permission for a meeting.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, host_id, allow_participants_to_record")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    const isHost = meeting.host_id === user.id;
    const canRecord = isHost || meeting.allow_participants_to_record === true;

    // Get active recording for this meeting
    const { data: activeRecording } = await supabase
      .from("meeting_recordings")
      .select("id, hms_recording_id, status, started_at, started_by, display_name")
      .eq("meeting_id", meetingId)
      .in("status", ["starting", "recording", "running"])
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    return Response.json({
      ok: true,
      isHost,
      canRecord,
      allowParticipantsToRecord: meeting.allow_participants_to_record || false,
      isRecording: !!activeRecording,
      activeRecording: activeRecording
        ? {
            id: activeRecording.id,
            hmsRecordingId: activeRecording.hms_recording_id,
            status: activeRecording.status,
            startedAt: activeRecording.started_at,
            startedBy: activeRecording.started_by,
            startedByName: activeRecording.display_name,
          }
        : null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


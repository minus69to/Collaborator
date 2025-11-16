import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { toErrorResponse, badRequest } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { getHMSRecordingAssets } from "@/lib/hms";

/**
 * List transcript/summary availability for a meeting's recordings
 * GET /api/insights/list?meetingId=ROOM_ID
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

    // Verify meeting and access
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, host_id")
      .eq("id", meetingId)
      .single();
    if (!meeting) {
      throw badRequest("Meeting not found");
    }

    const { data: participation } = await supabase
      .from("meeting_participants")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (meeting.host_id !== user.id && !participation) {
      throw badRequest("You don't have access to this meeting");
    }

    // Pull recordings from DB (already synced elsewhere)
    const { data: dbRecordings, error: recErr } = await supabase
      .from("meeting_recordings")
      .select("id, hms_recording_id, status, started_at, stopped_at")
      .eq("meeting_id", meetingId)
      .order("started_at", { ascending: false });
    if (recErr) throw recErr;

    const items = await Promise.all(
      (dbRecordings || []).map(async (r: any) => {
        if (!r.hms_recording_id) {
          return {
            recordingId: r.id,
            status: r.status,
            startedAt: r.started_at,
            stoppedAt: r.stopped_at,
            hasTranscript: false,
            hasSummary: false,
          };
        }
        try {
          const assets = await getHMSRecordingAssets(r.hms_recording_id);
          const hasTranscript = assets.some(
            (a: any) =>
              a.status === "completed" &&
              typeof a.type === "string" &&
              a.type.toLowerCase().includes("transcript")
          );
          const hasSummary = assets.some(
            (a: any) =>
              a.status === "completed" &&
              typeof a.type === "string" &&
              a.type.toLowerCase().includes("summary")
          );
          return {
            recordingId: r.hms_recording_id,
            status: r.status,
            startedAt: r.started_at,
            stoppedAt: r.stopped_at,
            hasTranscript,
            hasSummary,
          };
        } catch {
          return {
            recordingId: r.hms_recording_id,
            status: r.status,
            startedAt: r.started_at,
            stoppedAt: r.stopped_at,
            hasTranscript: false,
            hasSummary: false,
          };
        }
      })
    );

    return Response.json({ ok: true, items });
  } catch (error) {
    return toErrorResponse(error);
  }
}



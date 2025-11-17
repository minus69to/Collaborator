import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Check meeting and determine if current user is host
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, host_id")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    const isHost = meeting.host_id === user.id;

    if (isHost) {
      // Host: hard-delete meeting and related data so it disappears for everyone
      // Note: table names follow existing schema (chat_messages, meeting_files, meeting_recordings, etc.)
      const { error: deleteParticipantsError } = await supabase
        .from("meeting_participants")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteParticipantsError) throw deleteParticipantsError;

      const { error: deleteMessagesError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteMessagesError) throw deleteMessagesError;

      const { error: deleteFilesError } = await supabase
        .from("meeting_files")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteFilesError) throw deleteFilesError;

      const { error: deleteRecordingsError } = await supabase
        .from("meeting_recordings")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteRecordingsError) throw deleteRecordingsError;

      const { error: deleteJoinReqError } = await supabase
        .from("join_requests")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteJoinReqError) throw deleteJoinReqError;

      const { error: deleteMeetingError } = await supabase
        .from("meetings")
        .delete()
        .eq("id", meetingId);

      if (deleteMeetingError) {
        throw deleteMeetingError;
      }

      return Response.json({ ok: true, deletedFor: "host" });
    }

    // Non-host: hide from their dashboard only and force new permission next time
    const { error: deleteParticipationError } = await supabase
      .from("meeting_participants")
      .delete()
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id);

    if (deleteParticipationError) {
      throw deleteParticipationError;
    }

    const { error: deleteRequestsError } = await supabase
      .from("join_requests")
      .delete()
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id);

    if (deleteRequestsError) {
      throw deleteRequestsError;
    }

    return Response.json({ ok: true, deletedFor: "participant" });
  } catch (error) {
    return toErrorResponse(error);
  }
}



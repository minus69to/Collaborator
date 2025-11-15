import { NextRequest } from "next/server";
import { badRequest, forbidden, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

/**
 * Toggle participant recording permission for a meeting.
 * Only the host can change this setting.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { meetingId: string; allowParticipantsToRecord: boolean };

    if (!body.meetingId) {
      throw badRequest("meetingId is required");
    }

    if (typeof body.allowParticipantsToRecord !== "boolean") {
      throw badRequest("allowParticipantsToRecord must be a boolean");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, host_id")
      .eq("id", body.meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    // Only host can change permission
    if (meeting.host_id !== user.id) {
      throw forbidden("Only the host can change recording permissions");
    }

    // Update permission
    const { error: updateError } = await supabase
      .from("meetings")
      .update({
        allow_participants_to_record: body.allowParticipantsToRecord,
      })
      .eq("id", body.meetingId);

    if (updateError) {
      throw updateError;
    }

    return Response.json({
      ok: true,
      message: `Recording permission ${body.allowParticipantsToRecord ? "enabled" : "disabled"} for participants`,
      allowParticipantsToRecord: body.allowParticipantsToRecord,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


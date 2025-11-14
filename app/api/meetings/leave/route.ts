import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

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


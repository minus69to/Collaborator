import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Check if user is already an active participant in this meeting
    const { data: existingParticipant, error } = await supabase
      .from("meeting_participants")
      .select("*")
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id)
      .is("left_at", null)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Response.json({
      ok: true,
      isActiveParticipant: !!existingParticipant,
      participant: existingParticipant || null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


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

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw badRequest("Meeting not found");
    }

    // Allow access if user is the host or if meeting is public
    if (data.host_id !== user.id) {
      throw badRequest("You don't have permission to access this meeting");
    }

    return Response.json({ ok: true, meeting: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}


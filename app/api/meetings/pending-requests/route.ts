import { NextRequest } from "next/server";
import { badRequest, forbidden, toErrorResponse } from "@/lib/errors";
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

    // Verify user is the host
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, host_id")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    if (meeting.host_id !== user.id) {
      throw forbidden("Only the host can view join requests");
    }

    // Get pending join requests
    const { data: requests, error: requestsError } = await supabase
      .from("join_requests")
      .select("*")
      .eq("meeting_id", meetingId)
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    if (requestsError) {
      throw requestsError;
    }

    return Response.json({
      ok: true,
      requests: requests || [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


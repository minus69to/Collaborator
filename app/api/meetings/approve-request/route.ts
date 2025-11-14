import { NextRequest } from "next/server";
import { badRequest, forbidden, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { requestId: string; approve: boolean };

    if (!body.requestId) {
      throw badRequest("requestId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get the join request
    const { data: joinRequest, error: requestError } = await supabase
      .from("join_requests")
      .select("*")
      .eq("id", body.requestId)
      .single();

    if (requestError || !joinRequest) {
      throw badRequest("Join request not found");
    }

    // Verify user is the host of this meeting
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("host_id")
      .eq("id", joinRequest.meeting_id)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    if (meeting.host_id !== user.id) {
      throw forbidden("Only the host can approve/deny join requests");
    }

    if (joinRequest.status !== "pending") {
      throw badRequest("Join request is no longer pending");
    }

    // Update the join request
    const updateData: Record<string, unknown> = {
      status: body.approve ? "approved" : "rejected",
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    };

    const { data: updatedRequest, error: updateError } = await supabase
      .from("join_requests")
      .update(updateData)
      .eq("id", body.requestId)
      .select()
      .single();

    if (updateError || !updatedRequest) {
      throw new Error("Failed to update join request");
    }

    // Note: Participant record will be created when user actually joins via joinMeeting()
    // We don't create it here because the user hasn't actually joined the HMS room yet

    return Response.json({
      ok: true,
      request: updatedRequest,
      message: body.approve ? "Join request approved" : "Join request rejected",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


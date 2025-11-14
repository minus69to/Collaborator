import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { meetingId: string; displayName: string };

    if (!body.meetingId) {
      throw badRequest("meetingId is required");
    }

    if (!body.displayName || !body.displayName.trim()) {
      throw badRequest("displayName is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Check if meeting exists and get host info
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, host_id, status")
      .eq("id", body.meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    // If user is the host, allow immediate join (skip waiting room)
    if (meeting.host_id === user.id) {
      return Response.json({
        ok: true,
        approved: true,
        canJoin: true,
        message: "Host can join directly",
      });
    }

    // Check if there's already a pending or approved request
    const { data: existingRequest, error: existingError } = await supabase
      .from("join_requests")
      .select("*")
      .eq("meeting_id", body.meetingId)
      .eq("user_id", user.id)
      .single();

    if (existingRequest) {
      if (existingRequest.status === "approved") {
        return Response.json({
          ok: true,
          approved: true,
          canJoin: true,
          requestId: existingRequest.id,
          message: "Join request already approved",
        });
      } else if (existingRequest.status === "pending") {
        return Response.json({
          ok: true,
          approved: false,
          canJoin: false,
          requestId: existingRequest.id,
          message: "Join request is pending approval",
        });
      } else if (existingRequest.status === "rejected") {
        // Create a new request if previous one was rejected
        const { data: newRequest, error: insertError } = await supabase
          .from("join_requests")
          .insert({
            meeting_id: body.meetingId,
            user_id: user.id,
            display_name: body.displayName.trim(),
            status: "pending",
          })
          .select()
          .single();

        if (insertError || !newRequest) {
          throw new Error("Failed to create join request");
        }

        return Response.json({
          ok: true,
          approved: false,
          canJoin: false,
          requestId: newRequest.id,
          message: "Join request created. Waiting for host approval.",
        });
      }
    }

    // Create new join request
    const { data: joinRequest, error: insertError } = await supabase
      .from("join_requests")
      .insert({
        meeting_id: body.meetingId,
        user_id: user.id,
        display_name: body.displayName.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !joinRequest) {
      throw new Error("Failed to create join request");
    }

    return Response.json({
      ok: true,
      approved: false,
      canJoin: false,
      requestId: joinRequest.id,
      message: "Join request created. Waiting for host approval.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


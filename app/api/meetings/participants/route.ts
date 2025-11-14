import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

// Record participant joining
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      meetingId: string;
      role: "host" | "participant";
      displayName: string;
    };

    if (!body.meetingId || !body.role || !body.displayName) {
      throw badRequest("meetingId, role, and displayName are required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Verify meeting exists
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, host_id, status")
      .eq("id", body.meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    // Update meeting status to active if not already
    if (meeting.status !== "active") {
      await supabase
        .from("meetings")
        .update({ status: "active" })
        .eq("id", body.meetingId);
    }

    // Check if participant record already exists (from approval)
    const { data: existingParticipant } = await supabase
      .from("meeting_participants")
      .select("*")
      .eq("meeting_id", body.meetingId)
      .eq("user_id", user.id)
      .is("left_at", null)
      .order("joined_at", { ascending: false })
      .limit(1)
      .single();

    let participant;
    if (existingParticipant) {
      // Update existing record if needed (e.g., display name changed)
      const { data: updated, error: updateError } = await supabase
        .from("meeting_participants")
        .update({
          display_name: body.displayName.trim(),
          role: body.role,
        })
        .eq("id", existingParticipant.id)
        .select()
        .single();

      if (updateError || !updated) {
        throw new Error("Failed to update participant record");
      }
      participant = updated;
    } else {
      // Create new participant record
      const { data: newParticipant, error: insertError } = await supabase
        .from("meeting_participants")
        .insert({
          meeting_id: body.meetingId,
          user_id: user.id,
          role: body.role,
          display_name: body.displayName.trim(),
        })
        .select()
        .single();

      if (insertError || !newParticipant) {
        console.error("Insert error:", insertError);
        throw new Error(`Failed to create participant record: ${insertError?.message || "Unknown error"}`);
      }
      participant = newParticipant;
    }

    return Response.json({
      ok: true,
      participant,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Get participants for a meeting
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get all participants for this meeting
    const { data: participants, error: participantsError } = await supabase
      .from("meeting_participants")
      .select("*")
      .eq("meeting_id", meetingId)
      .is("left_at", null)
      .order("joined_at", { ascending: true });

    if (participantsError) {
      throw participantsError;
    }

    return Response.json({
      ok: true,
      participants: participants || [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


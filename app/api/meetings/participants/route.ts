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

    // Check if participant record already exists and is active
    // First, try to end any existing active participant records
    const { data: existingParticipants, error: checkError } = await supabase
      .from("meeting_participants")
      .select("*")
      .eq("meeting_id", body.meetingId)
      .eq("user_id", user.id)
      .is("left_at", null)
      .order("joined_at", { ascending: false });

    // End all existing active participant records (there should only be one, but handle multiple)
    if (existingParticipants && existingParticipants.length > 0) {
      const now = new Date().toISOString();
      const existingIds = existingParticipants.map(p => p.id);
      
      // Mark all existing records as left
      const { error: updateError } = await supabase
        .from("meeting_participants")
        .update({ left_at: now })
        .in("id", existingIds);

      if (updateError) {
        console.error("Error ending existing participant records:", updateError);
        // Continue anyway - try to create new record
      } else {
        console.log(`Ended ${existingParticipants.length} existing participant record(s)`);
        // Wait a moment to ensure database update is complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Now create new participant record
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

    const participant = newParticipant;

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

    // Fetch emails for all participants from auth.users
    const participantsWithEmails = await Promise.all(
      (participants || []).map(async (participant) => {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
            participant.user_id
          );
          
          return {
            ...participant,
            email: userData?.user?.email || null,
          };
        } catch (err) {
          console.error(`Error fetching email for user ${participant.user_id}:`, err);
          return {
            ...participant,
            email: null,
          };
        }
      })
    );

    return Response.json({
      ok: true,
      participants: participantsWithEmails || [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


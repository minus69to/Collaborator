import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

// Get messages for a meeting
export async function GET(request: NextRequest) {
  try {
    await requireUser(); // Must be authenticated
    
    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get all messages for this meeting, ordered by creation time
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return Response.json({
      ok: true,
      messages: messages || [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Send a message in a meeting
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    
    const body = (await request.json()) as {
      meetingId: string;
      message: string;
      displayName: string;
    };

    if (!body.meetingId || !body.message || !body.displayName) {
      throw badRequest("meetingId, message, and displayName are required");
    }

    // Validate message is not empty
    const trimmedMessage = body.message.trim();
    if (!trimmedMessage) {
      throw badRequest("Message cannot be empty");
    }

    // Validate message length (max 2000 characters)
    if (trimmedMessage.length > 2000) {
      throw badRequest("Message is too long (max 2000 characters)");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Verify meeting exists and is active
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id, status")
      .eq("id", body.meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    // Insert the message
    const { data: newMessage, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        meeting_id: body.meetingId,
        user_id: user.id,
        display_name: body.displayName.trim(),
        message: trimmedMessage,
      })
      .select()
      .single();

    if (insertError || !newMessage) {
      console.error("Insert error:", insertError);
      throw new Error(`Failed to send message: ${insertError?.message || "Unknown error"}`);
    }

    return Response.json({
      ok: true,
      message: newMessage,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}



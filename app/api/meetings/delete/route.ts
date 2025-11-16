import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Verify meeting exists and that the current user is the host
    const { data: meeting, error: fetchError } = await supabase
      .from("meetings")
      .select("id, host_id")
      .eq("id", meetingId)
      .single();

    if (fetchError || !meeting) {
      throw badRequest("Meeting not found");
    }

    if (meeting.host_id !== user.id) {
      throw badRequest("You are not allowed to delete this meeting");
    }

    // Soft-hide the meeting from the host on the meetings page by using an optional
    // hidden_for_host flag. If the column doesn't exist yet, surface a helpful error.
    const { error: deleteError } = await supabase
      .from("meetings")
      .update({ hidden_for_host: true })
      .eq("id", meetingId);

    if (deleteError && (deleteError as any).code === "42703") {
      throw new Error(
        "Database column 'hidden_for_host' not found on meetings table. Please add it with:\n" +
        "ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS hidden_for_host BOOLEAN NOT NULL DEFAULT false;"
      );
    }

    if (deleteError) {
      throw deleteError;
    }

    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}



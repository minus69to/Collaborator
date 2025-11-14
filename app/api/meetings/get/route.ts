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
      // Supabase returns PGRST116 when no rows are found with .single()
      // Also handle other potential errors
      if (error.code === "PGRST116" || error.message?.includes("No rows")) {
        throw badRequest("Meeting not found");
      }
      // If it's a PostgrestError, convert it to a proper error
      console.error("Database error fetching meeting:", error);
      throw badRequest(error.message || "Failed to fetch meeting");
    }

    if (!data) {
      throw badRequest("Meeting not found");
    }

    // Allow any authenticated user to access meeting details (to join)
    // Only the host can edit/delete meetings, but anyone can join
    return Response.json({ ok: true, meeting: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}


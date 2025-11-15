import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

// Get files for a meeting
export async function GET(request: NextRequest) {
  try {
    await requireUser(); // Must be authenticated

    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get all files for this meeting, ordered by upload time
    const { data: files, error } = await supabase
      .from("meeting_files")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("uploaded_at", { ascending: true });

    if (error) {
      throw error;
    }

    return Response.json({
      ok: true,
      files: files || [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


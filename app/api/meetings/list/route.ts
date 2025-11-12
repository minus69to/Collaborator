import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const hostId = request.nextUrl.searchParams.get("hostId");

    if (!hostId) {
      throw badRequest("hostId is required");
    }

    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("host_id", hostId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return Response.json({ ok: true, meetings: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}


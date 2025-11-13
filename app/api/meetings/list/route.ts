import { toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return Response.json({ ok: true, meetings: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}


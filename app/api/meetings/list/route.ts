import { toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const supabase = createSupabaseServiceRoleClient();
    // Try to respect optional hidden_for_host flag; fall back if column doesn't exist
    let { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("host_id", user.id)
      .eq("hidden_for_host", false)
      .order("created_at", { ascending: false });

    if (error && (error as any).code === "42703") {
      // Column doesn't exist yet – fall back to original query
      const fallback = await supabase
        .from("meetings")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }

    return Response.json({ ok: true, meetings: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}


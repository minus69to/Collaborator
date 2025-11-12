import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import type { PostgrestError } from "@supabase/supabase-js";

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(error) && typeof error === "object" && "code" in (error as Record<string, unknown>);
}

export async function GET() {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("meetings").select("id").limit(1);

  if (!error) {
    return Response.json({
      ok: true,
      reachable: true,
      sample: data?.[0] ?? null,
    });
  }

  if (isPostgrestError(error) && error.code === "42P01") {
    return Response.json({
      ok: true,
      reachable: true,
      msg: "Supabase reachable but `meetings` table not found yet",
      error,
    });
  }

  return Response.json(
    { ok: false, reachable: false, error: { message: error.message, code: isPostgrestError(error) ? error.code : null } },
    { status: 500 },
  );
}


import { validateEnv } from "@/lib/validateEnv";

export async function GET() {
  const env = validateEnv();

  return Response.json({
    ok: true,
    service: "collaborator",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    timestamp: new Date().toISOString(),
  });
}


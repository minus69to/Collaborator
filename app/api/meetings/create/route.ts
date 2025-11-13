import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

type CreateMeetingPayload = {
  title: string;
  description?: string;
  scheduledFor?: string;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<CreateMeetingPayload>;
    const user = await requireUser();

    if (!payload.title) {
      throw badRequest("title is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("meetings")
      .insert({
        host_id: user.id,
        title: payload.title,
        description: payload.description ?? null,
        scheduled_for: payload.scheduledFor ? new Date(payload.scheduledFor).toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return Response.json({ ok: true, meeting: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}


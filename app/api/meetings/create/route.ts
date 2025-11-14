import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { createHMSRoom } from "@/lib/hms";

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

    let hmsRoomId: string | null = null;

    // Try to create a 100ms room for this meeting
    try {
      const hmsRoom = await createHMSRoom(payload.title, payload.description);
      hmsRoomId = hmsRoom.id;
    } catch (hmsError) {
      // Log the error but don't fail the entire request
      console.error("Failed to create 100ms room:", hmsError);
      // Continue without hms_room_id if room creation fails
    }

    const supabase = createSupabaseServiceRoleClient();

    const insertData: Record<string, unknown> = {
      host_id: user.id,
      title: payload.title,
      description: payload.description ?? null,
      scheduled_for: payload.scheduledFor ? new Date(payload.scheduledFor).toISOString() : null,
    };

    // Only add hms_room_id if we successfully created the room
    if (hmsRoomId) {
      insertData.hms_room_id = hmsRoomId;
    }

    const { data, error } = await supabase
      .from("meetings")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If error is about missing column, provide helpful message
      if (error.message?.includes("hms_room_id") || error.code === "42703") {
        throw new Error(
          "Database column 'hms_room_id' not found. Please run the SQL migration: ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS hms_room_id TEXT;"
        );
      }
      throw error;
    }

    return Response.json({ ok: true, meeting: data });
  } catch (error) {
    console.error("Meeting creation error:", error);
    return toErrorResponse(error);
  }
}


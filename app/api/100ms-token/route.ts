import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateHMSToken } from "@/lib/hms";
import { toErrorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = (await request.json()) as { roomId: string; role?: string };
    const { roomId, role = "broadcaster" } = body; // Default to "broadcaster" to match template

    if (!roomId) {
      return Response.json({ error: "roomId is required" }, { status: 400 });
    }

    const token = await generateHMSToken(roomId, user.id, role);

    return Response.json({
      ok: true,
      token,
      roomId,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


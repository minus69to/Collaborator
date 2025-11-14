import { NextRequest } from "next/server";
import { SDK } from "@100mslive/server-sdk";
import { getServerEnv } from "@/lib/validateEnv";

const { HMS_ACCOUNT_ID, HMS_SECRET } = getServerEnv();
const hms = new SDK(HMS_ACCOUNT_ID.trim(), HMS_SECRET.trim());

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return Response.json({ error: "roomId query parameter is required" }, { status: 400 });
    }

    // Get room details
    const room = await hms.rooms.retrieveById(roomId);
    
    // Try to get room info that might include template/roles
    return Response.json({
      ok: true,
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        templateId: (room as any).template_id,
        templateName: (room as any).template_name,
        // Room object might have other properties
        fullRoom: room,
      },
      note: "Check the fullRoom object for available roles or template information",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return Response.json(
      {
        error: "Failed to get room info",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

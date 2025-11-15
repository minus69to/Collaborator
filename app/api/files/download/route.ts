import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

// Get download URL for a file
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      throw badRequest("fileId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get file metadata
    const { data: fileRecord, error: fileError } = await supabase
      .from("meeting_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !fileRecord) {
      throw badRequest("File not found");
    }

    // Verify user is a participant in the meeting (past or present)
    const { data: participant, error: participantError } = await supabase
      .from("meeting_participants")
      .select("id")
      .eq("meeting_id", fileRecord.meeting_id)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (participantError || !participant) {
      throw badRequest("You must be a participant in this meeting to download files");
    }

    // Generate signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from("meeting-files")
      .createSignedUrl(fileRecord.file_path, 3600); // 1 hour expiry

    if (urlError || !urlData) {
      throw new Error(`Failed to generate download URL: ${urlError?.message || "Unknown error"}`);
    }

    return Response.json({
      ok: true,
      file: {
        id: fileRecord.id,
        file_name: fileRecord.file_name,
        file_size: fileRecord.file_size,
        mime_type: fileRecord.mime_type,
        download_url: urlData.signedUrl,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


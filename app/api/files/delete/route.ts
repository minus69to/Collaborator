import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

// Delete a file (uploader only)
export async function DELETE(request: NextRequest) {
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

    // Verify user is the uploader (uploader only can delete)
    if (fileRecord.user_id !== user.id) {
      throw badRequest("You can only delete files you uploaded");
    }

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from("meeting-files")
      .remove([fileRecord.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue to delete metadata even if storage delete fails (orphaned record)
    }

    // Delete metadata record from database
    const { error: deleteError } = await supabase
      .from("meeting_files")
      .delete()
      .eq("id", fileId);

    if (deleteError) {
      throw new Error(`Failed to delete file metadata: ${deleteError.message}`);
    }

    return Response.json({
      ok: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const meetingId = formData.get("meetingId") as string | null;
    let displayName = formData.get("displayName") as string | null;

    if (!file) {
      throw badRequest("File is required");
    }

    if (!meetingId || !displayName) {
      throw badRequest("meetingId and displayName are required");
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw badRequest(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (file.size === 0) {
      throw badRequest("File cannot be empty");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Verify meeting exists and user is a participant
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("id")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      throw badRequest("Meeting not found");
    }

    // Check if user is an active participant in the meeting
    const { data: participant, error: participantError } = await supabase
      .from("meeting_participants")
      .select("id, display_name")
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id)
      .is("left_at", null)
      .order("joined_at", { ascending: false })
      .limit(1)
      .single();

    // Allow upload if user participated in the meeting (even if not currently active)
    if (!participant) {
      // Check if user ever participated in this meeting
      const { data: pastParticipant } = await supabase
        .from("meeting_participants")
        .select("id, display_name")
        .eq("meeting_id", meetingId)
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!pastParticipant) {
        throw badRequest("You must be a participant in this meeting to upload files");
      }

      // Use past participant's display name if available
      if (pastParticipant.display_name && !displayName) {
        displayName = pastParticipant.display_name;
      }
    }

    // Sanitize filename: remove special characters and ensure uniqueness
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileExtension = sanitizedFileName.split('.').pop() || '';
    const fileNameWithoutExt = sanitizedFileName.replace(/\.[^/.]+$/, '');
    const uniqueFileName = `${timestamp}-${fileNameWithoutExt}${fileExtension ? '.' + fileExtension : ''}`;

    // Storage path: meeting-files/{meeting_id}/{timestamp}-{sanitized_filename}
    const storagePath = `${meetingId}/${uniqueFileName}`;

    // Convert File to ArrayBuffer then to Blob
    const arrayBuffer = await file.arrayBuffer();
    const fileBlob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("meeting-files")
      .upload(storagePath, fileBlob, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Create metadata record in database
    const { data: fileRecord, error: insertError } = await supabase
      .from("meeting_files")
      .insert({
        meeting_id: meetingId,
        user_id: user.id,
        display_name: displayName?.trim() || '',
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      })
      .select()
      .single();

    if (insertError || !fileRecord) {
      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from("meeting-files")
        .remove([storagePath]);

      console.error("Database insert error:", insertError);
      throw new Error(`Failed to save file metadata: ${insertError?.message || "Unknown error"}`);
    }

    return Response.json({
      ok: true,
      file: {
        id: fileRecord.id,
        meeting_id: fileRecord.meeting_id,
        user_id: fileRecord.user_id,
        display_name: fileRecord.display_name,
        file_name: fileRecord.file_name,
        file_size: fileRecord.file_size,
        mime_type: fileRecord.mime_type,
        uploaded_at: fileRecord.uploaded_at,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


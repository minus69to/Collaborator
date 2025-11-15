import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { getHMSRecording, getHMSRecordingAssetDownloadUrl } from "@/lib/hms";

/**
 * GET endpoint to get a direct download URL for a recording.
 * This uses the 100ms Management API to fetch pre-signed URLs from their storage.
 * The URL is generated server-side to keep management credentials secure.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const recordingId = searchParams.get("recordingId");
    const meetingId = searchParams.get("meetingId");

    if (!recordingId || !meetingId) {
      throw badRequest("recordingId and meetingId are required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Verify user has access to this recording
    const { data: recording } = await supabase
      .from("meeting_recordings")
      .select("meeting_id, hms_recording_id, hms_asset_id, display_name")
      .eq("id", recordingId)
      .eq("meeting_id", meetingId)
      .single();

    if (!recording) {
      throw badRequest("Recording not found");
    }

    // Check if user has access to this meeting
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, host_id")
      .eq("id", meetingId)
      .single();

    if (!meeting) {
      throw badRequest("Meeting not found");
    }

    // Check if user is host or participant
    const { data: participation } = await supabase
      .from("meeting_participants")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (meeting.host_id !== user.id && !participation) {
      throw badRequest("You don't have access to this recording");
    }

    // Try to get download URL using asset ID if available
    let downloadUrl: string | null = null;

    if (recording.hms_asset_id) {
      console.log(`[Download URL] Attempting to get URL for asset ${recording.hms_asset_id}...`);
      downloadUrl = await getHMSRecordingAssetDownloadUrl(recording.hms_asset_id);
    }

    // If we don't have asset_id, fetch recording details to get it
    if (!downloadUrl && recording.hms_recording_id) {
      console.log(`[Download URL] Fetching recording details for ${recording.hms_recording_id}...`);
      try {
        const hmsRecording = await getHMSRecording(recording.hms_recording_id);
        
        // Try to get URL from recording asset
        if (hmsRecording.assetId) {
          downloadUrl = await getHMSRecordingAssetDownloadUrl(hmsRecording.assetId);
        }
        
        // Fallback to URL from recording metadata
        if (!downloadUrl && hmsRecording.url) {
          // Check if it's a direct download URL (not preview page)
          // Preview URLs typically contain "/preview/" or "/__internal_recorder"
          if (!hmsRecording.url.includes('/preview/') && !hmsRecording.url.includes('/__internal_recorder')) {
            downloadUrl = hmsRecording.url;
          }
        }
      } catch (error) {
        console.error(`[Download URL] Failed to fetch recording:`, error);
      }
    }

    if (!downloadUrl) {
      return Response.json(
        {
          ok: false,
          error: "Download URL not available. The recording may still be processing or unavailable.",
        },
        { status: 404 }
      );
    }

    console.log(`[Download URL] ✓ Returning download URL for recording ${recordingId}`);

    return Response.json({
      ok: true,
      downloadUrl: downloadUrl,
      expiresAt: null, // Pre-signed URLs typically expire, but we don't know the exact time
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


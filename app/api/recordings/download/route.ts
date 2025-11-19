import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { getHMSRecordingAssetDownloadUrl, getHMSRecording } from "@/lib/hms";
import { getSignedDownloadUrl } from "@/lib/storage";

/**
 * GET endpoint to proxy recording download.
 * Attempts to fetch the actual video file and stream it to the client.
 * Falls back to redirecting to preview URL if direct download isn't available.
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();

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
      .select("meeting_id, url, hms_asset_id, hms_recording_id, display_name, started_at")
      .eq("id", recordingId)
      .eq("meeting_id", meetingId)
      .single();

    if (!recording) {
      throw badRequest("Recording not found");
    }
    
    console.log(`[Recording Download] Starting download for recording ${recordingId}:`, {
      hms_recording_id: recording.hms_recording_id,
      hms_asset_id: recording.hms_asset_id,
      display_name: recording.display_name,
    });

    // Always fetch fresh recording details from 100ms to get the correct asset ID
    let downloadUrl: string | null = null;
    let assetIdToUse: string | null = null;

    if (recording.hms_recording_id) {
      console.log(`[Recording Download] Fetching fresh recording details from 100ms for ${recording.hms_recording_id}...`);
      try {
        const hmsRecording = await getHMSRecording(recording.hms_recording_id);
        
        console.log(`[Recording Download] 100ms recording details:`, {
          status: hmsRecording.status,
          assetId: hmsRecording.assetId,
          storedAssetId: recording.hms_asset_id,
          urlPresent: !!hmsRecording.url,
        });
        
        // Use the asset ID from 100ms (always fresh)
        assetIdToUse = hmsRecording.assetId || recording.hms_asset_id;
        
        // Try to get download URL from asset API (prefer fresh asset ID from 100ms)
        if (assetIdToUse) {
          console.log(`[Recording Download] Attempting to get download URL for asset ${assetIdToUse}...`);
          downloadUrl = await getHMSRecordingAssetDownloadUrl(assetIdToUse);
          if (downloadUrl) {
            console.log(`[Recording Download] Download URL: ${downloadUrl}`);
            console.log(`[Recording Download] ✓ Got download URL from asset API`);
          } else {
            console.log(`[Recording Download] ✗ Could not get download URL from asset API`);
          }
        }
        
        // Fallback: Use URL from recording if it's not a preview page
        if (!downloadUrl && hmsRecording.url) {
          // Preview URLs contain "/preview/" or "/__internal_recorder"
          // If it's not a preview URL, it might be a direct download URL
          if (!hmsRecording.url.includes('/preview/') && !hmsRecording.url.includes('/__internal_recorder')) {
            downloadUrl = hmsRecording.url;
            console.log(`[Recording Download] Using non-preview URL from recording metadata`);
          }
        }
      } catch (error) {
        console.error(`[Recording Download] Failed to fetch recording from 100ms:`, error);
        
        // Fallback: try stored asset ID if fresh fetch failed
        if (!downloadUrl && recording.hms_asset_id) {
          console.log(`[Recording Download] Fallback: Using stored asset ID ${recording.hms_asset_id}...`);
          downloadUrl = await getHMSRecordingAssetDownloadUrl(recording.hms_asset_id);
          console.log(`[Recording Download] Download URL: ${downloadUrl}`);

        }
      }
    } else if (recording.hms_asset_id) {
      // No recording ID but have asset ID - try direct asset lookup
      console.log(`[Recording Download] No hms_recording_id, using stored asset ID ${recording.hms_asset_id}...`);
      downloadUrl = await getHMSRecordingAssetDownloadUrl(recording.hms_asset_id);
      console.log(`[Recording Download] Download URL: ${downloadUrl}`);
    }

    // Fallback to stored URL only if we don't have a download URL from asset API
    const videoUrl = downloadUrl || recording.url;

    if (!videoUrl) {
      throw badRequest("Recording URL not available yet. Please try again later.");
    }
    
    console.log(`[Recording Download] Using video URL: ${videoUrl.substring(0, 100)}...`);

    // Redirect authenticated clients directly to the signed asset URL.
    // This ensures they download the exact file that 100ms serves (avoiding the
    // re-streaming quirks that made some players drop the video track).
    console.log(`[Recording Download] Redirecting client to signed asset URL`);
    return Response.redirect(videoUrl, 302);
  } catch (error) {
    return toErrorResponse(error);
  }
}



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
        }
      }
    } else if (recording.hms_asset_id) {
      // No recording ID but have asset ID - try direct asset lookup
      console.log(`[Recording Download] No hms_recording_id, using stored asset ID ${recording.hms_asset_id}...`);
      downloadUrl = await getHMSRecordingAssetDownloadUrl(recording.hms_asset_id);
    }

    // Fallback to stored URL only if we don't have a download URL from asset API
    const videoUrl = downloadUrl || recording.url;

    if (!videoUrl) {
      throw badRequest("Recording URL not available yet. Please try again later.");
    }
    
    console.log(`[Recording Download] Using video URL: ${videoUrl.substring(0, 100)}...`);

    // Try to fetch the actual video file
    console.log(`[Recording Download] Attempting to fetch video from: ${videoUrl.substring(0, 100)}...`);
    
    try {
      const videoResponse = await fetch(videoUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "video/mp4,video/*,*/*",
        },
        redirect: "follow",
      });

      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }

      const contentType = videoResponse.headers.get("content-type") || "";
      console.log(`[Recording Download] Response Content-Type: ${contentType}`);

      // If it's HTML, it's the preview page, not the video
      if (contentType.includes("text/html")) {
        console.log(`[Recording Download] URL returns HTML (preview page), cannot download directly`);
        throw badRequest("Recording download is not available. The recording may only be available as a preview page.");
      }

      // Get the file as a buffer
      const fileBuffer = await videoResponse.arrayBuffer();
      
      console.log(`[Recording Download] Fetched ${fileBuffer.byteLength} bytes, Content-Type: ${contentType}`);
      
      // Check if we got actual video data (at least 1KB for a valid video file)
      if (fileBuffer.byteLength < 1000) {
        console.log(`[Recording Download] Received suspiciously small file: ${fileBuffer.byteLength} bytes`);
        throw badRequest("Recording file is too small. The recording may still be processing or unavailable.");
      }

      // Generate a filename
      const dateStr = new Date(recording.started_at).toISOString().split("T")[0];
      const timeStr = new Date(recording.started_at).toTimeString().split(" ")[0].replace(/:/g, "-");
      const fileName = `recording-${recording.display_name}-${dateStr}-${timeStr}.mp4`;

      console.log(`[Recording Download] ✓ Successfully fetched ${fileBuffer.byteLength} bytes, serving as ${fileName}`);

      // Return the file with appropriate headers
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType.includes("video") ? contentType : "video/mp4",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Length": fileBuffer.byteLength.toString(),
          "Cache-Control": "no-cache",
        },
      });
    } catch (fetchError) {
      console.error(`[Recording Download] Failed to fetch video directly:`, fetchError);
      
      // If it's a badRequest error, re-throw it
      if (fetchError && typeof fetchError === 'object' && 'status' in fetchError) {
        throw fetchError;
      }
      
      // Otherwise, throw a generic error
      throw badRequest(`Failed to download recording: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}



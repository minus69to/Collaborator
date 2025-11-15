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
      .select("meeting_id, url, hms_asset_id, hms_recording_id, file_path, storage_provider, display_name, started_at")
      .eq("id", recordingId)
      .eq("meeting_id", meetingId)
      .single();

    if (!recording) {
      throw badRequest("Recording not found");
    }

    // Priority 1: If recording is stored in custom storage, generate signed URL
    if (recording.file_path && recording.storage_provider && recording.storage_provider !== '100ms') {
      console.log(`[Recording Download] Using custom storage: ${recording.storage_provider} for path: ${recording.file_path}`);
      const signedUrl = await getSignedDownloadUrl(recording.file_path, recording.storage_provider, 3600);
      if (signedUrl) {
        // Redirect to signed URL (or fetch and proxy if needed)
        return Response.redirect(signedUrl, 307);
      } else {
        console.error(`[Recording Download] Failed to generate signed URL for custom storage`);
        // Fall through to try other methods
      }
    }

    // Priority 2: Try to get download URL from 100ms Management API using asset_id
    let downloadUrl: string | null = null;
    if (recording.hms_asset_id) {
      console.log(`[Recording Download] Attempting to get download URL from 100ms Management API for asset ${recording.hms_asset_id}...`);
      downloadUrl = await getHMSRecordingAssetDownloadUrl(recording.hms_asset_id);
      if (downloadUrl) {
        console.log(`[Recording Download] ✓ Got download URL from 100ms Management API`);
      }
    }

    // Priority 3: If we don't have asset_id but have recording_id, fetch recording to get asset_id
    if (!downloadUrl && recording.hms_recording_id) {
      console.log(`[Recording Download] Fetching recording details to get asset_id...`);
      try {
        const hmsRecording = await getHMSRecording(recording.hms_recording_id);
        if (hmsRecording.assetId) {
          downloadUrl = await getHMSRecordingAssetDownloadUrl(hmsRecording.assetId);
          if (downloadUrl) {
            console.log(`[Recording Download] ✓ Got download URL after fetching asset_id`);
          }
        }
        
        // Fallback: Use URL from recording if it's not a preview page
        if (!downloadUrl && hmsRecording.url) {
          // Preview URLs contain "/preview/" or "/__internal_recorder"
          // If it's not a preview URL, it might be a direct download URL
          if (!hmsRecording.url.includes('/preview/') && !hmsRecording.url.includes('/__internal_recorder')) {
            downloadUrl = hmsRecording.url;
            console.log(`[Recording Download] Using URL from recording metadata (non-preview)`);
          }
        }
      } catch (e) {
        console.error(`[Recording Download] Failed to fetch recording details:`, e);
      }
    }

    // Priority 4: Fallback to stored URL (might be preview URL)
    const videoUrl = downloadUrl || recording.url;

    if (!videoUrl) {
      throw badRequest("Recording URL not available yet. Please try again later.");
    }

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
        // Return redirect to preview URL
        return Response.redirect(recording.url, 307);
      }

      // Get the file as a buffer
      const fileBuffer = await videoResponse.arrayBuffer();
      
      // Check if we got actual video data
      if (fileBuffer.byteLength < 1000) {
        console.log(`[Recording Download] Received suspiciously small file: ${fileBuffer.byteLength} bytes`);
        // Return redirect to preview URL
        return Response.redirect(recording.url, 307);
      }

      // Generate a filename
      const dateStr = new Date(recording.started_at).toISOString().split("T")[0];
      const timeStr = new Date(recording.started_at).toTimeString().split(" ")[0].replace(/:/g, "-");
      const fileName = `recording-${recording.display_name}-${dateStr}-${timeStr}.mp4`;

      console.log(`[Recording Download] ✓ Successfully fetched ${fileBuffer.byteLength} bytes`);

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
      // Fallback: redirect to preview URL
      console.log(`[Recording Download] Falling back to preview URL redirect`);
      return Response.redirect(recording.url, 307);
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}


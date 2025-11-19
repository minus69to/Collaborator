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
      .select("meeting_id, hms_recording_id, hms_asset_id, display_name, started_at")
      .eq("id", recordingId)
      .eq("meeting_id", meetingId)
      .single();

    if (!recording) {
      throw badRequest("Recording not found");
    }
    
    console.log(`[Download URL] Looking up recording ${recordingId}:`, {
      hms_recording_id: recording.hms_recording_id,
      hms_asset_id: recording.hms_asset_id,
      display_name: recording.display_name,
      started_at: recording.started_at,
    });

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

    // Always fetch fresh recording details from 100ms to ensure we have the correct asset ID
    // This prevents issues with stale or incorrect asset IDs in the database
    let downloadUrl: string | null = null;
    let assetIdToUse: string | null = null;

    if (recording.hms_recording_id) {
      console.log(`[Download URL] Fetching fresh recording details from 100ms for ${recording.hms_recording_id}...`);
      try {
        const hmsRecording = await getHMSRecording(recording.hms_recording_id);
        
        console.log(`[Download URL] 100ms recording details:`, {
          status: hmsRecording.status,
          assetId: hmsRecording.assetId,
          storedAssetId: recording.hms_asset_id,
          urlPresent: !!hmsRecording.url,
          filePath: hmsRecording.filePath,
        });
        
        // Use the asset ID from 100ms (always fresh) - this should be the video asset
        assetIdToUse = hmsRecording.assetId || recording.hms_asset_id;
        
        // Try to get URL from recording asset (prefer fresh asset ID from 100ms)
        if (assetIdToUse) {
          console.log(`[Download URL] Attempting to get download URL for video asset ${assetIdToUse}...`);
          downloadUrl = await getHMSRecordingAssetDownloadUrl(assetIdToUse);
          if (downloadUrl) {
            console.log(`[Download URL] ✓ Got download URL from asset API (length: ${downloadUrl.length})`);
            // Log first 100 chars to see if it's a video URL
            console.log(`[Download URL] URL preview: ${downloadUrl.substring(0, 100)}...`);
          } else {
            console.log(`[Download URL] ✗ Could not get download URL from asset API`);
          }
        } else {
          console.log(`[Download URL] ⚠ No asset ID available (neither from 100ms nor stored)`);
        }
        
        // Fallback to URL from recording metadata
        if (!downloadUrl && hmsRecording.url) {
          // Check if it's a direct download URL (not preview page)
          // Preview URLs typically contain "/preview/" or "/__internal_recorder"
          if (!hmsRecording.url.includes('/preview/') && !hmsRecording.url.includes('/__internal_recorder')) {
            downloadUrl = hmsRecording.url;
            console.log(`[Download URL] Using non-preview URL from recording metadata`);
          }
        }
      } catch (error) {
        console.error(`[Download URL] Failed to fetch recording from 100ms:`, error);
        
        // Fallback: try stored asset ID if fresh fetch failed
        if (!downloadUrl && recording.hms_asset_id) {
          console.log(`[Download URL] Fallback: Using stored asset ID ${recording.hms_asset_id}...`);
          downloadUrl = await getHMSRecordingAssetDownloadUrl(recording.hms_asset_id);
          if (downloadUrl) {
            console.log(`[Download URL] ✓ Got download URL from fallback asset`);
          }
        }
      }
      
      // Update database with the correct video asset ID if we found a new one (outside try-catch)
      if (assetIdToUse && assetIdToUse !== recording.hms_asset_id && downloadUrl) {
        console.log(`[Download URL] Updating database with correct video asset ID: ${assetIdToUse}`);
        try {
          await supabase
            .from("meeting_recordings")
            .update({ hms_asset_id: assetIdToUse })
            .eq("id", recordingId)
            .eq("meeting_id", meetingId);
        } catch (dbError) {
          console.error(`[Download URL] Failed to update asset ID in database:`, dbError);
          // Don't fail the request if DB update fails
        }
      }
    } else if (recording.hms_asset_id) {
      // No recording ID but have asset ID - try direct asset lookup
      console.log(`[Download URL] No hms_recording_id, using stored asset ID ${recording.hms_asset_id}...`);
      downloadUrl = await getHMSRecordingAssetDownloadUrl(recording.hms_asset_id);
    }

    if (!downloadUrl) {
      return Response.json(
        {
          ok: false,
          error: "Streaming URL not available. The recording may still be processing or unavailable.",
        },
        { status: 404 }
      );
    }

    console.log(`[Download URL] ✓ Redirecting to streaming URL for recording ${recordingId}`);

    // Redirect the client directly to the signed asset URL so it can open in a new tab.
    return Response.redirect(downloadUrl, 302);
  } catch (error) {
    return toErrorResponse(error);
  }
}


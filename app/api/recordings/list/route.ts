import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { getHMSRecording, getHMSRecordingAssetDownloadUrl } from "@/lib/hms";

/**
 * GET endpoint to list recordings for a meeting.
 * Also updates recording status and URL from 100ms for recordings that don't have URLs yet.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const meetingId = searchParams.get("meetingId");

    if (!meetingId) {
      throw badRequest("meetingId is required");
    }

    const supabase = createSupabaseServiceRoleClient();

    // Verify user has access to this meeting (either as host or participant)
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
      throw badRequest("You don't have access to this meeting");
    }

    // Get all recordings for this meeting
    const { data: recordings, error: recordingsError } = await supabase
      .from("meeting_recordings")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("started_at", { ascending: false });

    if (recordingsError) {
      throw recordingsError;
    }

    // Update recordings that don't have URLs yet by fetching latest status from 100ms
    if (recordings && recordings.length > 0) {
      console.log(`[Recordings List] Found ${recordings.length} recordings for meeting ${meetingId}`);
      
      const updatePromises = recordings.map(async (recording) => {
        // Check ALL recordings without URLs that have an HMS recording ID
        // This ensures we fetch URLs from 100ms as soon as they become available
        const shouldCheck = !recording.url && recording.hms_recording_id;
        
        if (shouldCheck) {
          try {
            console.log(`[Recordings List] Fetching recording ${recording.hms_recording_id} from 100ms...`);
            // Fetch latest recording status from 100ms
            const hmsRecording = await getHMSRecording(recording.hms_recording_id);
            
            console.log(`[Recordings List] 100ms recording ${recording.hms_recording_id}:`, {
              status: hmsRecording.status,
              url: hmsRecording.url ? 'PRESENT' : 'MISSING',
              urlValue: hmsRecording.url || null,
              assetId: hmsRecording.assetId || null,
              filePath: hmsRecording.filePath || null,
              duration: hmsRecording.duration,
              fileSize: hmsRecording.fileSize,
            });
            
            // Try to get download URL from asset if we have an asset ID
            let downloadUrl: string | null = null;
            if (hmsRecording.assetId && !recording.hms_asset_id) {
              console.log(`[Recordings List] Attempting to get download URL for asset ${hmsRecording.assetId}...`);
              downloadUrl = await getHMSRecordingAssetDownloadUrl(hmsRecording.assetId);
              if (downloadUrl) {
                console.log(`[Recordings List] ✓ Got download URL from asset API`);
              } else {
                console.log(`[Recordings List] ✗ Could not get download URL from asset API`);
              }
            }
            
            // Use download URL from asset API if available, otherwise use the URL from recording
            const finalUrl = downloadUrl || hmsRecording.url;
            
            // Determine storage provider based on file path presence
            // If file_path exists, it's likely custom storage (S3, GCS, etc.)
            const storageProvider = hmsRecording.filePath ? 
              (hmsRecording.filePath.includes('s3://') || hmsRecording.filePath.includes('gs://') ? 
                (hmsRecording.filePath.includes('s3://') ? 's3' : 'gcs') : 'custom') : 
              '100ms';
            
            // Always update if we have new data (URL, status, duration, asset_id, file_path, etc.)
            const hasUpdates = finalUrl || 
                              (hmsRecording.status && hmsRecording.status !== recording.status) ||
                              (hmsRecording.duration !== null && hmsRecording.duration !== recording.duration) ||
                              (hmsRecording.fileSize !== null && hmsRecording.fileSize !== recording.file_size) ||
                              (hmsRecording.assetId && hmsRecording.assetId !== recording.hms_asset_id) ||
                              (hmsRecording.filePath && hmsRecording.filePath !== recording.file_path);
            
            if (hasUpdates) {
              const updateData: any = {
                updated_at: new Date().toISOString(),
              };
              
              // Always update status if available
              if (hmsRecording.status) {
                updateData.status = hmsRecording.status;
              }
              
              // Update asset ID if available
              if (hmsRecording.assetId) {
                updateData.hms_asset_id = hmsRecording.assetId;
              }
              
              // Update file path if available (for custom storage)
              if (hmsRecording.filePath) {
                updateData.file_path = hmsRecording.filePath;
                updateData.storage_provider = storageProvider;
                console.log(`[Recordings List] ✓ Updating recording ${recording.id} with file_path: ${hmsRecording.filePath.substring(0, 50)}... (storage: ${storageProvider})`);
              }
              
              // Update URL if available (prefer download URL from asset API)
              if (finalUrl) {
                updateData.url = finalUrl;
                console.log(`[Recordings List] ✓ Updating recording ${recording.id} with URL: ${finalUrl.substring(0, 50)}...`);
              }
              
              if (hmsRecording.stoppedAt) {
                updateData.stopped_at = hmsRecording.stoppedAt;
              }
              
              if (hmsRecording.duration !== null && hmsRecording.duration !== undefined) {
                updateData.duration = hmsRecording.duration;
              }
              
              if (hmsRecording.fileSize !== null && hmsRecording.fileSize !== undefined) {
                updateData.file_size = hmsRecording.fileSize;
              }
              
              const { data: updatedRecord, error: updateError } = await supabase
                .from("meeting_recordings")
                .update(updateData)
                .eq("id", recording.id)
                .select()
                .single();
              
              if (updateError) {
                console.error(`[Recordings List] ✗ Failed to update recording ${recording.id} in database:`, updateError);
                return recording; // Return original if update failed
              } else {
                console.log(`[Recordings List] ✓ Successfully updated recording ${recording.id}`, {
                  newUrl: updateData.url ? 'PRESENT' : 'MISSING',
                  newStatus: updateData.status,
                });
                // Return updated recording from database
                return updatedRecord || { ...recording, ...updateData };
              }
            } else {
              console.log(`[Recordings List] No updates needed for recording ${recording.hms_recording_id}`);
            }
          } catch (error) {
            // If recording not found or error fetching, just continue with existing data
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Recordings List] ✗ Failed to fetch recording ${recording.hms_recording_id} from 100ms:`, errorMessage);
          }
        } else {
          if (recording.url) {
            console.log(`[Recordings List] Recording ${recording.hms_recording_id} already has URL, skipping check`);
          } else if (!recording.hms_recording_id) {
            console.log(`[Recordings List] Recording ${recording.id} has no hms_recording_id, skipping check`);
          }
        }
        
        return recording;
      });
      
      // Wait for all updates to complete
      const updatedRecordings = await Promise.all(updatePromises);
      
      // Re-fetch from database to ensure we have the latest data
      const { data: finalRecordings, error: finalError } = await supabase
        .from("meeting_recordings")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("started_at", { ascending: false });
      
      if (!finalError && finalRecordings) {
        console.log(`[Recordings List] Returning ${finalRecordings.length} recordings (${finalRecordings.filter(r => r.url).length} with URLs)`);
        return Response.json({
          ok: true,
          recordings: finalRecordings,
        });
      }
      
      return Response.json({
        ok: true,
        recordings: updatedRecordings || [],
      });
    }

    return Response.json({
      ok: true,
      recordings: recordings || [],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


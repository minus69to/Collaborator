import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { getHMSRecording, getHMSRecordingAssetDownloadUrl, listHMSRecordings } from "@/lib/hms";

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
      .select("id, host_id, hms_room_id")
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

    // Sync recordings from 100ms if room ID is available
    if (meeting.hms_room_id) {
      try {
        console.log(`[Recordings List] Syncing recordings from 100ms for room ${meeting.hms_room_id}...`);
        const hmsRecordings = await listHMSRecordings(meeting.hms_room_id);
        console.log(`[Recordings List] Found ${hmsRecordings.length} recordings in 100ms`);
        
        // Get all existing recordings from database (by hms_recording_id)
        const { data: existingRecordings } = await supabase
          .from("meeting_recordings")
          .select("id, hms_recording_id, hms_asset_id")
          .eq("meeting_id", meetingId)
          .not("hms_recording_id", "is", null);
        
        const existingHmsIds = new Set(
          (existingRecordings || []).map(r => r.hms_recording_id)
        );
        
        // Create map of hms_recording_id to database record ID
        const hmsIdToDbId = new Map(
          (existingRecordings || []).map(r => [r.hms_recording_id, r.id])
        );
        
        // Create missing recordings in database or update existing ones
        for (const hmsRec of hmsRecordings) {
          const existingDbId = hmsIdToDbId.get(hmsRec.id);
          
          if (!existingDbId) {
            // Recording doesn't exist in database - create it
            console.log(`[Recordings List] Creating missing recording ${hmsRec.id} in database...`);
            
            // Get detailed recording info from 100ms
            let detailedRec: any = null;
            try {
              detailedRec = await getHMSRecording(hmsRec.id);
            } catch (err) {
              console.error(`[Recordings List] Failed to get details for recording ${hmsRec.id}:`, err);
              // Use basic info from list
              detailedRec = hmsRec;
            }
            
            // Determine who started the recording (try to find from participants or use host as default)
            let startedBy = meeting.host_id;
            let displayName = "Unknown";
            
            // Try to get display name from participant records
            const { data: participants } = await supabase
              .from("meeting_participants")
              .select("user_id, display_name")
              .eq("meeting_id", meetingId)
              .order("joined_at", { ascending: true })
              .limit(1);
            
            if (participants && participants.length > 0) {
              startedBy = participants[0].user_id;
              displayName = participants[0].display_name || displayName;
            }
            
            // Create recording record
            // Note: file_path and storage_provider columns may not exist in all database schemas
            const { error: createError } = await supabase
              .from("meeting_recordings")
              .insert({
                meeting_id: meetingId,
                hms_recording_id: hmsRec.id,
                started_by: startedBy,
                display_name: displayName,
                status: detailedRec.status || hmsRec.status || 'unknown',
                url: detailedRec.url || null,
                started_at: detailedRec.startedAt || hmsRec.startedAt || new Date().toISOString(),
                stopped_at: detailedRec.stoppedAt || hmsRec.stoppedAt || null,
                auto_stopped: false,
                duration: detailedRec.duration || null,
                file_size: detailedRec.fileSize || null,
                hms_asset_id: detailedRec.assetId || null,
                // file_path and storage_provider removed - columns don't exist in schema
              });
            
              if (createError) {
                console.error(`[Recordings List] Failed to create recording ${hmsRec.id} in database:`, createError);
              } else {
                console.log(`[Recordings List] ✓ Created recording ${hmsRec.id} in database`);
              }
          } else {
            // Recording exists - update it with fresh data from 100ms if needed
            try {
              const detailedRec = await getHMSRecording(hmsRec.id);
              const existingRec = existingRecordings?.find(r => r.id === existingDbId);
              
              // Update if we have new asset ID or if asset ID is missing
              const needsUpdate = (detailedRec.assetId && detailedRec.assetId !== existingRec?.hms_asset_id) ||
                                  (!existingRec?.hms_asset_id && detailedRec.assetId);
              
              if (needsUpdate) {
                console.log(`[Recordings List] Updating recording ${hmsRec.id} (DB ID: ${existingDbId}) with fresh asset ID...`);
                const { error: updateError } = await supabase
                  .from("meeting_recordings")
                  .update({
                    hms_asset_id: detailedRec.assetId || null,
                    status: detailedRec.status || null,
                    url: detailedRec.url || null,
                    duration: detailedRec.duration || null,
                    file_size: detailedRec.fileSize || null,
                    stopped_at: detailedRec.stoppedAt || null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", existingDbId);
                
                if (updateError) {
                  console.error(`[Recordings List] Failed to update recording ${existingDbId}:`, updateError);
                } else {
                  console.log(`[Recordings List] ✓ Updated recording ${existingDbId} with fresh data`);
                }
              }
            } catch (updateErr) {
              console.error(`[Recordings List] Failed to update existing recording ${hmsRec.id}:`, updateErr);
            }
          }
        }
      } catch (syncError) {
        console.error(`[Recordings List] Failed to sync recordings from 100ms:`, syncError);
        // Continue with existing database records even if sync fails
      }
    }

    // Get all recordings for this meeting (including newly synced ones)
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
        // This includes stopped recordings that are still processing (no URL yet)
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
            
            // Try to get download URL from asset if we have an asset ID but no URL
            // Try even if we already have the asset ID stored (it might be ready now)
            let downloadUrl: string | null = null;
            const assetIdToCheck = hmsRecording.assetId || recording.hms_asset_id;
            if (assetIdToCheck && !recording.url) {
              console.log(`[Recordings List] Attempting to get download URL for asset ${assetIdToCheck}...`);
              downloadUrl = await getHMSRecordingAssetDownloadUrl(assetIdToCheck);
              if (downloadUrl) {
                console.log(`[Recordings List] ✓ Got download URL from asset API`);
              } else {
                console.log(`[Recordings List] ✗ Could not get download URL from asset API`);
              }
            }
            
            // Use download URL from asset API if available, otherwise use the URL from recording
            const finalUrl = downloadUrl || hmsRecording.url;
            
            // Always update if we have new data (URL, status, duration, asset_id, etc.)
            const hasUpdates = finalUrl || 
                              (hmsRecording.status && hmsRecording.status !== recording.status) ||
                              (hmsRecording.duration !== null && hmsRecording.duration !== recording.duration) ||
                              (hmsRecording.fileSize !== null && hmsRecording.fileSize !== recording.file_size) ||
                              (hmsRecording.assetId && hmsRecording.assetId !== recording.hms_asset_id);
            
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
              
              // Note: file_path and storage_provider columns may not exist in all database schemas
              // Only update them if the columns exist (we'll skip them if they cause errors)
              
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


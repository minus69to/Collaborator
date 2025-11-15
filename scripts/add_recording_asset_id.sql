-- Add asset_id column to store the video asset ID from 100ms
ALTER TABLE public.meeting_recordings 
ADD COLUMN IF NOT EXISTS hms_asset_id TEXT;

CREATE INDEX IF NOT EXISTS meeting_recordings_hms_asset_id_idx ON public.meeting_recordings (hms_asset_id);


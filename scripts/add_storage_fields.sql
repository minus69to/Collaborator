-- Add fields to support custom storage providers
ALTER TABLE public.meeting_recordings 
ADD COLUMN IF NOT EXISTS file_path TEXT, -- Path in storage bucket (e.g., "recordings/meeting-123/video.mp4")
ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT '100ms'; -- '100ms', 's3', 'gcs', 'oss'

-- Add index for storage provider lookups
CREATE INDEX IF NOT EXISTS meeting_recordings_storage_provider_idx ON public.meeting_recordings (storage_provider);

-- Add comment for documentation
COMMENT ON COLUMN public.meeting_recordings.file_path IS 'Path to recording file in storage bucket (for custom storage)';
COMMENT ON COLUMN public.meeting_recordings.storage_provider IS 'Storage provider: 100ms (default), s3 (AWS), gcs (Google Cloud), oss (Alibaba)';


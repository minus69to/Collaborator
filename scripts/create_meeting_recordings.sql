-- Create table for meeting recordings
CREATE TABLE IF NOT EXISTS public.meeting_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  hms_recording_id TEXT NOT NULL, -- The recording ID from 100ms
  started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User who started the recording
  display_name TEXT NOT NULL, -- Display name of user who started
  status TEXT NOT NULL DEFAULT 'starting', -- starting, recording, stopped, completed, failed
  url TEXT, -- Recording URL (available after processing)
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  stopped_at TIMESTAMP WITH TIME ZONE, -- When recording was stopped (manually or auto)
  stopped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User who stopped (if manual)
  auto_stopped BOOLEAN DEFAULT false, -- true if stopped automatically when meeting ended
  duration INTEGER, -- Duration in seconds
  file_size BIGINT, -- File size in bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS meeting_recordings_meeting_id_idx ON public.meeting_recordings (meeting_id);
CREATE INDEX IF NOT EXISTS meeting_recordings_status_idx ON public.meeting_recordings (status);
CREATE INDEX IF NOT EXISTS meeting_recordings_started_at_idx ON public.meeting_recordings (started_at);
CREATE INDEX IF NOT EXISTS meeting_recordings_hms_recording_id_idx ON public.meeting_recordings (hms_recording_id);

-- Add column to meetings table for recording permission
-- This allows host to toggle if participants can start/stop recording
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS allow_participants_to_record BOOLEAN DEFAULT false;

-- Create index for permission lookup
CREATE INDEX IF NOT EXISTS meetings_allow_participants_to_record_idx ON public.meetings (allow_participants_to_record);

-- Add comment for documentation
COMMENT ON TABLE public.meeting_recordings IS 'Stores recording sessions for meetings';
COMMENT ON COLUMN public.meeting_recordings.status IS 'Recording status: starting, recording, stopped, completed, failed';
COMMENT ON COLUMN public.meeting_recordings.auto_stopped IS 'True if recording was automatically stopped when meeting ended';
COMMENT ON COLUMN public.meetings.allow_participants_to_record IS 'If true, all participants can start/stop recording (in addition to host)';


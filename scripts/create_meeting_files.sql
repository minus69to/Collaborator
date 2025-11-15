-- Table for meeting files metadata
CREATE TABLE IF NOT EXISTS public.meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS meeting_files_meeting_id_idx ON public.meeting_files (meeting_id);
CREATE INDEX IF NOT EXISTS meeting_files_user_id_idx ON public.meeting_files (user_id);
CREATE INDEX IF NOT EXISTS meeting_files_uploaded_at_idx ON public.meeting_files (uploaded_at);
CREATE INDEX IF NOT EXISTS meeting_files_meeting_uploaded_idx ON public.meeting_files (meeting_id, uploaded_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view files for meetings they participated in
CREATE POLICY "Users can view files for meetings they participated in"
  ON public.meeting_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_participants.meeting_id = meeting_files.meeting_id
      AND meeting_participants.user_id = auth.uid()
    )
  );

-- Policy: Users can upload files to meetings they are participating in
CREATE POLICY "Users can upload files to meetings they are participating in"
  ON public.meeting_files
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_participants.meeting_id = meeting_files.meeting_id
      AND meeting_participants.user_id = auth.uid()
      AND meeting_participants.left_at IS NULL
    )
  );

-- Policy: Users can delete files they uploaded
CREATE POLICY "Users can delete files they uploaded"
  ON public.meeting_files
  FOR DELETE
  USING (auth.uid() = user_id);


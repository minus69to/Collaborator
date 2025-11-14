-- Create join_requests table for waiting room functionality
CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'joined')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES auth.users(id),
  UNIQUE(meeting_id, user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS join_requests_meeting_id_idx ON public.join_requests (meeting_id);
CREATE INDEX IF NOT EXISTS join_requests_user_id_idx ON public.join_requests (user_id);
CREATE INDEX IF NOT EXISTS join_requests_status_idx ON public.join_requests (status);

-- Create meeting_participants table to track who joined which meeting
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('host', 'participant')),
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id, joined_at)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS meeting_participants_meeting_id_idx ON public.meeting_participants (meeting_id);
CREATE INDEX IF NOT EXISTS meeting_participants_user_id_idx ON public.meeting_participants (user_id);
CREATE INDEX IF NOT EXISTS meeting_participants_meeting_user_idx ON public.meeting_participants (meeting_id, user_id);

-- Add status field to meetings table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'meetings' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.meetings ADD COLUMN status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended'));
  END IF;
END $$;

-- Add ended_at field to meetings table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'meetings' 
    AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE public.meetings ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for join_requests
CREATE POLICY "Users can view their own join requests"
  ON public.join_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Hosts can view join requests for their meetings"
  ON public.join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE meetings.id = join_requests.meeting_id
      AND meetings.host_id = auth.uid()
    )
  );

CREATE POLICY "Users can create join requests"
  ON public.join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts can update join requests for their meetings"
  ON public.join_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE meetings.id = join_requests.meeting_id
      AND meetings.host_id = auth.uid()
    )
  );

-- RLS Policies for meeting_participants
CREATE POLICY "Users can view their own participation records"
  ON public.meeting_participants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own participation records"
  ON public.meeting_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation records"
  ON public.meeting_participants FOR UPDATE
  USING (auth.uid() = user_id);


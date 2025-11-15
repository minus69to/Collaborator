-- Table for chat messages in meetings
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS chat_messages_meeting_id_idx ON public.chat_messages (meeting_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages (created_at);
CREATE INDEX IF NOT EXISTS chat_messages_meeting_created_idx ON public.chat_messages (meeting_id, created_at);



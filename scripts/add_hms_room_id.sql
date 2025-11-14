-- Add hms_room_id column to meetings table
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS hms_room_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS meetings_hms_room_id_idx ON public.meetings (hms_room_id);


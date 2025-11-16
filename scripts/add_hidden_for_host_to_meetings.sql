-- Add a flag to hide meetings from the host's Meetings page without losing history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meetings'
      AND column_name = 'hidden_for_host'
  ) THEN
    ALTER TABLE public.meetings
      ADD COLUMN hidden_for_host BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;



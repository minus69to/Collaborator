# Supabase Storage Setup Guide

## Step 1: Create the Database Table

Run the SQL migration in Supabase SQL Editor:
```sql
-- Execute the contents of scripts/create_meeting_files.sql
```

## Step 2: Create Storage Bucket in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Storage** (left sidebar)
3. Click **"New bucket"**
4. Create a bucket with these settings:
   - **Name**: `meeting-files`
   - **Public bucket**: ❌ **Unchecked** (Private)
   - **File size limit**: `10485760` (10MB in bytes)
   - **Allowed MIME types**: Leave empty (no restrictions)

## Step 3: Configure Storage Policies

Go to **Storage** → **Policies** → Select `meeting-files` bucket

### Policy 1: Allow authenticated users to upload files
**Policy name**: `Users can upload files to meetings they are in`

**SQL Policy**:
```sql
CREATE POLICY "Users can upload files to meetings they are in"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meeting-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

Actually, a simpler approach - allow authenticated users to upload to the bucket:
```sql
CREATE POLICY "Users can upload files to meeting-files bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'meeting-files');
```

### Policy 2: Allow users to read files from meetings they participated in
**Policy name**: `Users can read files from meetings they participated in`

**SQL Policy**:
```sql
CREATE POLICY "Users can read files from meetings they participated in"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'meeting-files'
  AND EXISTS (
    SELECT 1 FROM public.meeting_files
    WHERE meeting_files.file_path = name
    AND EXISTS (
      SELECT 1 FROM public.meeting_participants
      WHERE meeting_participants.meeting_id = meeting_files.meeting_id
      AND meeting_participants.user_id = auth.uid()
    )
  )
);
```

### Policy 3: Allow users to delete files they uploaded
**Policy name**: `Users can delete files they uploaded`

**SQL Policy**:
```sql
CREATE POLICY "Users can delete files they uploaded"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meeting-files'
  AND EXISTS (
    SELECT 1 FROM public.meeting_files
    WHERE meeting_files.file_path = name
    AND meeting_files.user_id = auth.uid()
  )
);
```

**Note**: For simpler testing, you can temporarily use:
```sql
-- Temporary: Allow all authenticated users to read/write/delete
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'meeting-files');
CREATE POLICY "Allow authenticated reads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'meeting-files');
CREATE POLICY "Allow authenticated deletes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'meeting-files');
```

Then test the upload functionality, and we'll refine the policies after.

## Step 4: Test Storage Configuration

After setting up, test using:
- API endpoint: `POST /api/files/test-upload`
- Or use the test file: `scripts/test-storage.js`

## File Path Structure

Files will be stored as:
```
meeting-files/
  {meeting_id}/
    {timestamp}-{sanitized_filename}
```

Example:
```
meeting-files/
  550e8400-e29b-41d4-a716-446655440000/
    1703123456789-document.pdf
```

## Environment Variables

Make sure these are set in your `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for server-side operations)


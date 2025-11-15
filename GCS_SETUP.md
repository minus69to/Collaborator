# Google Cloud Storage Setup for 100ms Recordings

This guide will help you configure Google Cloud Storage (GCS) to store your 100ms recordings.

## Prerequisites

- A Google Cloud Platform (GCP) account
- Access to the GCP Console
- Your 100ms Dashboard credentials

## Step 1: Create a GCS Bucket

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. Navigate to **Cloud Storage** → **Buckets**:
   - Click the hamburger menu (☰) → **Cloud Storage** → **Buckets**

3. Click **"Create Bucket"**

4. Configure your bucket:
   - **Name**: Choose a unique name (e.g., `your-app-recordings` or `collaborator-recordings`)
   - **Location Type**: Choose **Region** (recommended for better performance)
   - **Location**: Select a region close to your users (e.g., `us-east1`, `us-west1`, `europe-west1`)
   - **Storage Class**: **Standard** (good for frequently accessed recordings)
   - **Access Control**: **Uniform** (recommended)
   - **Public Access**: **Prevent public access** (secure your recordings)
   
5. Click **"Create"**

✅ **Note down your bucket name** - you'll need it later!

## Step 2: Create a Service Account

1. In the GCP Console, navigate to **IAM & Admin** → **Service Accounts**:
   - Click the hamburger menu (☰) → **IAM & Admin** → **Service Accounts**

2. Click **"Create Service Account"** at the top

3. Fill in the details:
   - **Service Account Name**: `100ms-recording-service` (or any name you prefer)
   - **Service Account ID**: Will auto-populate (you can change it)
   - **Description**: `Service account for 100ms recording storage`

4. Click **"Create and Continue"**

5. **Grant Access**:
   - Click **"Select a role"** dropdown
   - Search for and select: **Storage Object Admin** (or `roles/storage.objectAdmin`)
   - This role allows reading, writing, and deleting objects in buckets
   
   ⚠️ **Alternative (More Secure)**: If you want minimal permissions, use:
   - **Storage Object Creator** (`roles/storage.objectCreator`) - for creating files only
   - **Storage Object Viewer** (`roles/storage.objectViewer`) - for reading files only
   
   But for 100ms, **Storage Object Admin** is recommended.

6. Click **"Continue"**

7. (Optional) Add users who can manage this service account, then click **"Done"**

✅ **Service account created!**

## Step 3: Create and Download JSON Key

1. In the **Service Accounts** list, find the service account you just created (`100ms-recording-service`)

2. Click on the service account name to open its details

3. Go to the **"Keys"** tab at the top

4. Click **"Add Key"** → **"Create new key"**

5. Select **JSON** as the key type

6. Click **"Create"**

7. **IMPORTANT**: The JSON key file will download automatically. **Save this file securely!**
   - Keep it private - it gives full access to your storage bucket
   - **DO NOT commit this file to Git** - add it to `.gitignore`

8. **Save the file path** - you'll need it for environment variables
   - Example: `/home/smt/Desktop/Collaborator/gcs-key.json` or `./gcs-key.json`

## Step 4: Get Your GCP Project ID

1. In the GCP Console, look at the top bar - you'll see your **Project ID** (e.g., `my-project-123456`)

2. **Note down your Project ID** - you'll need it for environment variables

Alternatively:
- Click the project name at the top → **Project Settings**
- Copy the **Project ID**

## Step 5: Configure CORS (Optional but Recommended)

If you want to allow direct downloads from the browser:

1. Go to **Cloud Storage** → **Buckets**

2. Click on your bucket name

3. Go to the **"Permissions"** tab

4. Click **"Edit CORS Configuration"** (if available)

5. Add this CORS configuration:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "responseHeader": ["Content-Type", "Content-Disposition"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

6. Click **"Save"**

## Step 6: Configure in 100ms Dashboard

1. Go to [100ms Dashboard](https://dashboard.100ms.live/)

2. Navigate to your **Template**:
   - Go to **Templates** → Select your template (or create one)

3. Open the **"Recording"** tab

4. Scroll down to **"Storage Configuration"**

5. Select **"Google Cloud Storage"** as the storage provider

6. Fill in the details:
   - **Bucket Name**: Enter your bucket name (e.g., `your-app-recordings`)
   - **Service Account JSON**: 
     - Open the JSON key file you downloaded
     - **Copy the entire contents** (all JSON)
     - **Paste it into this field**
   - **Path Prefix** (optional): `recordings/` (to organize files in a folder)
     - Example: Files will be stored as `recordings/meeting-123/video.mp4`

7. Click **"Test Connection"** to verify:
   - ✅ If successful, you'll see a success message
   - ❌ If failed, check your bucket name, project ID, and service account permissions

8. Click **"Save"**

✅ **100ms is now configured to use your GCS bucket!**

## Step 7: Install Required NPM Package

In your project directory, install the Google Cloud Storage SDK:

```bash
npm install @google-cloud/storage
```

## Step 8: Configure Environment Variables

Add these environment variables to your `.env.local` file:

```env
# Google Cloud Storage Configuration
GCS_RECORDINGS_BUCKET=your-app-recordings
GCS_SERVICE_ACCOUNT_KEY_FILE=./gcs-key.json
GCS_PROJECT_ID=your-project-id
```

**Explanation:**
- `GCS_RECORDINGS_BUCKET`: Your bucket name (from Step 1)
- `GCS_SERVICE_ACCOUNT_KEY_FILE`: Path to your JSON key file (from Step 3)
  - Use relative path from project root: `./gcs-key.json`
  - Or absolute path: `/home/smt/Desktop/Collaborator/gcs-key.json`
- `GCS_PROJECT_ID`: Your GCP project ID (from Step 4)

## Step 9: Secure Your Key File

1. **Add to `.gitignore`** (if not already there):
   ```
   # Google Cloud Service Account Key
   gcs-key.json
   *.json
   !package.json
   !tsconfig.json
   ```

2. **Verify it's ignored**:
   ```bash
   git status
   # Should NOT show gcs-key.json
   ```

3. **Store the key securely**:
   - Don't share it publicly
   - Consider using environment variables in production instead of file path

## Step 10: Run Database Migration

Run the SQL migration to add storage fields:

```bash
# In your Supabase dashboard SQL editor, or via psql:
# Run the contents of scripts/add_storage_fields.sql
```

Or manually:
```sql
ALTER TABLE public.meeting_recordings 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT '100ms';

CREATE INDEX IF NOT EXISTS meeting_recordings_storage_provider_idx 
ON public.meeting_recordings (storage_provider);
```

## Step 11: Test the Setup

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Create a test meeting** and start a recording

3. **Stop the recording**

4. **Check your GCS bucket**:
   - Go to GCP Console → Cloud Storage → Buckets
   - Click your bucket
   - You should see recording files appear in the `recordings/` folder (or root if no prefix)

5. **Test download**:
   - Try downloading a recording from your dashboard
   - It should work directly without redirecting to a preview page

## Troubleshooting

### ❌ "Test Connection" fails in 100ms Dashboard

**Possible causes:**
1. **Incorrect bucket name** - Double-check the bucket name
2. **Service account lacks permissions** - Ensure "Storage Object Admin" role is assigned
3. **Invalid JSON key** - Make sure you copied the entire JSON file
4. **Bucket doesn't exist** - Verify the bucket was created

**Fix:**
- Verify service account has `Storage Object Admin` role
- Re-download the JSON key and paste it again
- Check bucket name matches exactly

### ❌ "Failed to generate signed URL" error

**Possible causes:**
1. **Environment variables not set** - Check `.env.local`
2. **Key file not found** - Verify file path is correct
3. **Wrong project ID** - Ensure `GCS_PROJECT_ID` matches your GCP project

**Fix:**
```bash
# Check environment variables are loaded
echo $GCS_RECORDINGS_BUCKET
echo $GCS_PROJECT_ID

# Verify key file exists
ls -la gcs-key.json
```

### ❌ Files not appearing in bucket

**Possible causes:**
1. **100ms template not saved** - Ensure you clicked "Save" after configuration
2. **Wrong template** - Verify the meeting is using the correct template
3. **Recording still processing** - Wait a few minutes for processing to complete

**Fix:**
- Double-check template configuration is saved
- Verify template ID matches the one used in meetings
- Check 100ms dashboard for recording status

### ❌ CORS errors when downloading

**Fix:**
- Follow Step 5 to configure CORS
- Or download files server-side (current implementation handles this)

## Alternative: Use Environment Variables Instead of Key File

For production, you can use environment variables instead of a file:

1. Extract values from JSON key:
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "100ms-recording-service@your-project-id.iam.gserviceaccount.com",
     ...
   }
   ```

2. Set environment variables:
   ```env
   GCS_PROJECT_ID=your-project-id
   GCS_CLIENT_EMAIL=100ms-recording-service@your-project-id.iam.gserviceaccount.com
   GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

3. Update `lib/storage.ts` to use env vars instead of file (if needed)

## Cost Estimation

GCS pricing (as of 2024):
- **Storage**: ~$0.020 per GB/month (Standard class)
- **Operations**: 
  - Write: $0.05 per 10,000 operations
  - Read: $0.004 per 10,000 operations

**Example:**
- 100 recordings/month, average 50MB each = 5GB
- Monthly cost: ~$0.10 for storage + minimal operation costs

**Much cheaper than 100ms managed storage!**

## Next Steps

After setup:
1. ✅ New recordings will automatically go to your GCS bucket
2. ✅ Downloads will use signed URLs (direct download, no preview redirect)
3. ✅ You have full control over retention and access
4. ✅ Files are stored in your own cloud storage

## Support Resources

- [Google Cloud Storage Docs](https://cloud.google.com/storage/docs)
- [100ms Storage Configuration](https://www.100ms.live/docs/get-started/v2/get-started/features/recordings/recording-assets/storage-configuration)
- [GCS Node.js SDK](https://cloud.google.com/nodejs/docs/reference/storage/latest)


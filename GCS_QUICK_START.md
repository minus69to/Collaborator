# Google Cloud Storage - Quick Start Guide

Follow these steps to set up GCS for 100ms recordings:

## 🚀 Quick Setup (5 Steps)

### 1️⃣ Create GCS Bucket
1. Go to [GCP Console](https://console.cloud.google.com/storage/buckets)
2. Click **"Create Bucket"**
3. Name: `your-app-recordings` (or any unique name)
4. Location: Choose region (e.g., `us-east1`)
5. Click **"Create"**

### 2️⃣ Create Service Account
1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **"Create Service Account"**
3. Name: `100ms-recording-service`
4. Click **"Create and Continue"**
5. Role: **Storage Object Admin**
6. Click **"Done"**

### 3️⃣ Download JSON Key
1. Click on the service account you just created
2. Go to **"Keys"** tab → **"Add Key"** → **"Create new key"**
3. Select **JSON** → **"Create"**
4. **Save the downloaded file** as `gcs-key.json` in your project root

### 4️⃣ Configure in 100ms Dashboard
1. Go to [100ms Dashboard](https://dashboard.100ms.live/)
2. **Templates** → Your Template → **Recording** tab
3. **Storage Configuration**:
   - Provider: **Google Cloud Storage**
   - Bucket Name: `your-app-recordings`
   - Service Account JSON: **Paste entire JSON file contents**
   - Path Prefix: `recordings/` (optional)
4. Click **"Test Connection"** → **"Save"**

### 5️⃣ Configure Environment & Install Package
```bash
# Install GCS SDK
npm install @google-cloud/storage

# Add to .env.local
echo "GCS_RECORDINGS_BUCKET=your-app-recordings" >> .env.local
echo "GCS_SERVICE_ACCOUNT_KEY_FILE=./gcs-key.json" >> .env.local
echo "GCS_PROJECT_ID=your-project-id" >> .env.local
```

### 6️⃣ Run Database Migration
In Supabase SQL Editor, run:
```sql
ALTER TABLE public.meeting_recordings 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT '100ms';

CREATE INDEX IF NOT EXISTS meeting_recordings_storage_provider_idx 
ON public.meeting_recordings (storage_provider);
```

## ✅ Done!

New recordings will now:
- ✅ Be stored in your GCS bucket
- ✅ Have direct download URLs (no preview redirects)
- ✅ Be accessible via signed URLs

## 📚 Full Guide

For detailed instructions, troubleshooting, and advanced setup, see **[GCS_SETUP.md](./GCS_SETUP.md)**

## 🆘 Quick Troubleshooting

**"Test Connection" fails?**
- Verify bucket name is correct
- Check service account has "Storage Object Admin" role
- Ensure JSON key is complete (all {} braces)

**Files not appearing?**
- Verify template is saved in 100ms dashboard
- Check recording completed processing
- Look in bucket's `recordings/` folder (if prefix set)

**Download errors?**
- Check environment variables in `.env.local`
- Verify `gcs-key.json` file exists and is readable
- Ensure `GCS_PROJECT_ID` matches your GCP project


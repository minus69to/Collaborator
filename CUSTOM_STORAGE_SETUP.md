# Custom Storage Setup for 100ms Recordings

## Overview

By default, 100ms stores recordings in their managed storage for 15 days. This can cause issues with:
- Direct download URLs (only preview URLs available)
- Limited retention period
- No direct file access

**Solution:** Configure your own cloud storage (AWS S3, Google Cloud Storage, etc.) to have full control over recordings.

## Benefits of Custom Storage

✅ **Direct file access** - Get direct download URLs for recordings  
✅ **Custom retention** - Keep recordings as long as you need  
✅ **Better control** - Manage access, permissions, and storage costs  
✅ **Reliable downloads** - No dependency on 100ms preview pages  

## Setup Instructions

### Option 1: AWS S3 (Recommended)

#### Step 1: Create S3 Bucket

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Create a new bucket (e.g., `your-app-recordings`)
3. **Important:** Configure bucket for CORS if needed:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": []
     }
   ]
   ```

#### Step 2: Create IAM User for 100ms

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new user (e.g., `100ms-recording-user`)
3. Attach a policy with these permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-app-recordings/*",
           "arn:aws:s3:::your-app-recordings"
         ]
       }
     ]
   }
   ```
4. Create Access Key and Secret Key (save these!)

#### Step 3: Configure in 100ms Dashboard

1. Go to [100ms Dashboard](https://dashboard.100ms.live/)
2. Navigate to your **Template** → **Recording** tab
3. Under **Storage Configuration**, select **AWS S3**
4. Enter:
   - **Bucket Name**: `your-app-recordings`
   - **Access Key ID**: (from IAM user)
   - **Secret Access Key**: (from IAM user)
   - **Region**: (e.g., `us-east-1`)
   - **Path Prefix** (optional): `recordings/` (to organize files)
5. Click **Test Connection** to verify
6. Click **Save**

### Option 2: Google Cloud Storage

#### Step 1: Create GCS Bucket

1. Go to [Google Cloud Console](https://console.cloud.google.com/storage)
2. Create a new bucket (e.g., `your-app-recordings`)
3. Set appropriate permissions

#### Step 2: Create Service Account

1. Go to [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create a new service account (e.g., `100ms-recording-service`)
3. Grant role: **Storage Object Admin**
4. Create and download JSON key file

#### Step 3: Configure in 100ms Dashboard

1. Go to [100ms Dashboard](https://dashboard.100ms.live/)
2. Navigate to your **Template** → **Recording** tab
3. Under **Storage Configuration**, select **Google Cloud Storage**
4. Enter:
   - **Bucket Name**: `your-app-recordings`
   - **Service Account JSON**: (paste the entire JSON key file content)
   - **Path Prefix** (optional): `recordings/`
5. Click **Test Connection** to verify
6. Click **Save**

## After Setup

Once custom storage is configured:

1. **New recordings** will be stored in your bucket
2. **File paths** will be available in recording metadata
3. **Direct download URLs** can be generated using your storage provider's SDK

## Updating Your Code

After setting up custom storage, you'll need to:

1. **Update recording retrieval** to get file paths from 100ms
2. **Generate signed URLs** using your storage provider's SDK (AWS S3, GCS, etc.)
3. **Update download endpoint** to use signed URLs instead of 100ms preview URLs

### Example: AWS S3 Signed URL Generation

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function getRecordingDownloadUrl(filePath: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: "your-app-recordings",
    Key: filePath,
  });
  
  // Generate signed URL valid for 1 hour
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}
```

### Example: Google Cloud Storage Signed URL

```typescript
import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  keyFilename: "path/to/service-account-key.json",
});

async function getRecordingDownloadUrl(filePath: string): Promise<string> {
  const bucket = storage.bucket("your-app-recordings");
  const file = bucket.file(filePath);
  
  // Generate signed URL valid for 1 hour
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 3600 * 1000, // 1 hour
  });
  
  return url;
}
```

## Database Schema Update

You may want to store the file path in your database:

```sql
ALTER TABLE public.meeting_recordings 
ADD COLUMN IF NOT EXISTS file_path TEXT; -- Path in your storage bucket
ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT '100ms'; -- '100ms', 's3', 'gcs'
```

## Testing

After setup:

1. Start a test recording
2. Stop the recording
3. Check your storage bucket - you should see the recording file
4. Verify the file path is available in 100ms recording metadata
5. Test download using signed URLs

## Troubleshooting

- **Connection test fails**: Check credentials and bucket permissions
- **No files in bucket**: Verify template is using the correct storage config
- **CORS errors**: Ensure bucket CORS is configured correctly
- **Signed URL issues**: Check expiration time and permissions

## Resources

- [100ms Storage Configuration Docs](https://www.100ms.live/docs/get-started/v2/get-started/features/recordings/recording-assets/storage-configuration)
- [AWS S3 Setup Guide](https://docs.aws.amazon.com/s3/)
- [Google Cloud Storage Setup](https://cloud.google.com/storage/docs)


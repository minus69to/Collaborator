/**
 * Storage helpers for generating signed URLs from custom storage providers.
 * This is used when recordings are stored in AWS S3, Google Cloud Storage, etc.
 * instead of 100ms default storage.
 */

import { getServerEnv } from "./validateEnv";

/**
 * Generate a signed download URL for a recording stored in custom storage.
 * 
 * @param filePath - The file path in the storage bucket
 * @param storageProvider - The storage provider ('s3', 'gcs', 'oss', etc.)
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL for downloading the file
 */
export async function getSignedDownloadUrl(
  filePath: string,
  storageProvider: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    switch (storageProvider.toLowerCase()) {
      case 's3':
        return await getS3SignedUrl(filePath, expiresIn);
      case 'gcs':
        return await getGCSSignedUrl(filePath, expiresIn);
      case 'oss':
        return await getOSSSignedUrl(filePath, expiresIn);
      default:
        console.log(`[Storage] Unsupported or not configured storage provider: ${storageProvider}`);
        return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[Storage] Failed to generate signed URL (storage not configured): ${errorMessage}`);
    return null;
  }
}

/**
 * Generate a signed URL for AWS S3.
 * Requires AWS SDK packages: @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
 */
async function getS3SignedUrl(filePath: string, expiresIn: number): Promise<string | null> {
  try {
    // Dynamic import to avoid errors if package is not installed
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3").catch(() => null);
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner").catch(() => null);
    
    if (!S3Client || !GetObjectCommand || !getSignedUrl) {
      console.log(`[Storage] AWS S3 SDK not installed - skipping S3 signed URL generation`);
      return null;
    }
    
    const env = getServerEnv();
    const bucketName = process.env.AWS_S3_RECORDINGS_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    
    if (!bucketName) {
      console.error('[Storage] AWS_S3_RECORDINGS_BUCKET environment variable not set');
      return null;
    }
    
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    
    // Remove s3:// prefix if present
    const key = filePath.replace(/^s3:\/\/[^\/]+\//, '').replace(/^[^\/]+\//, '');
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    console.log(`[Storage] Generated S3 signed URL for ${key} (expires in ${expiresIn}s)`);
    return url;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      console.error('[Storage] AWS SDK not installed. Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner');
    }
    throw error;
  }
}

/**
 * Generate a signed URL for Google Cloud Storage.
 * Requires @google-cloud/storage package
 */
async function getGCSSignedUrl(filePath: string, expiresIn: number): Promise<string | null> {
  try {
    // Dynamic import to avoid errors if package is not installed
    const { Storage } = await import("@google-cloud/storage").catch(() => null);
    
    if (!Storage) {
      console.log(`[Storage] Google Cloud Storage SDK not installed - skipping GCS signed URL generation`);
      return null;
    }
    
    const bucketName = process.env.GCS_RECORDINGS_BUCKET;
    
    if (!bucketName) {
      console.error('[Storage] GCS_RECORDINGS_BUCKET environment variable not set');
      return null;
    }
    
    const storage = new Storage({
      keyFilename: process.env.GCS_SERVICE_ACCOUNT_KEY_FILE,
      projectId: process.env.GCS_PROJECT_ID,
    });
    
    const bucket = storage.bucket(bucketName);
    
    // Remove gs:// prefix if present
    const key = filePath.replace(/^gs:\/\/[^\/]+\//, '').replace(/^[^\/]+\//, '');
    
    const file = bucket.file(key);
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    
    console.log(`[Storage] Generated GCS signed URL for ${key} (expires in ${expiresIn}s)`);
    return url;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      console.error('[Storage] Google Cloud Storage SDK not installed. Install with: npm install @google-cloud/storage');
    }
    throw error;
  }
}

/**
 * Generate a signed URL for Alibaba Cloud OSS.
 * Requires ali-oss package
 */
async function getOSSSignedUrl(filePath: string, expiresIn: number): Promise<string | null> {
  try {
    // Dynamic import to avoid errors if package is not installed
    const ossModule = await import('ali-oss').catch(() => null);
    if (!ossModule) {
      console.log(`[Storage] Alibaba OSS SDK not installed - skipping OSS signed URL generation`);
      return null;
    }
    const OSS = ossModule.default;
    
    const bucketName = process.env.OSS_RECORDINGS_BUCKET;
    const region = process.env.OSS_REGION || 'oss-us-east-1';
    
    if (!bucketName) {
      console.error('[Storage] OSS_RECORDINGS_BUCKET environment variable not set');
      return null;
    }
    
    const client = new OSS({
      region,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: bucketName,
    });
    
    // Remove oss:// prefix if present
    const key = filePath.replace(/^oss:\/\/[^\/]+\//, '').replace(/^[^\/]+\//, '');
    
    const url = client.signatureUrl(key, {
      expires: expiresIn,
    });
    
    console.log(`[Storage] Generated OSS signed URL for ${key} (expires in ${expiresIn}s)`);
    return url;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      console.error('[Storage] Alibaba OSS SDK not installed. Install with: npm install ali-oss');
    }
    throw error;
  }
}


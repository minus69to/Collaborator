import { NextRequest } from "next/server";
import { badRequest, toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

// Test endpoint to verify Supabase Storage is configured correctly
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const supabase = createSupabaseServiceRoleClient();

    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw new Error(`Failed to list buckets: ${bucketsError.message}`);
    }

    const meetingFilesBucket = buckets?.find(b => b.name === 'meeting-files');
    
    if (!meetingFilesBucket) {
      return Response.json({
        ok: false,
        error: "Bucket 'meeting-files' not found. Please create it in Supabase Storage.",
        buckets: buckets?.map(b => b.name) || [],
      }, { status: 404 });
    }

    // Check bucket configuration
    const bucketInfo = {
      name: meetingFilesBucket.name,
      public: meetingFilesBucket.public,
      fileSizeLimit: meetingFilesBucket.fileSizeLimit,
      allowedMimeTypes: meetingFilesBucket.allowedMimeTypes,
    };

    // Test file upload with a small test file
    const testFileName = `test/${user.id}/test-${Date.now()}.txt`;
    const testFileContent = `Test file uploaded at ${new Date().toISOString()}`;
    const testFileBlob = new Blob([testFileContent], { type: 'text/plain' });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meeting-files')
      .upload(testFileName, testFileBlob, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) {
      return Response.json({
        ok: false,
        error: `Upload test failed: ${uploadError.message}`,
        bucketInfo,
        details: uploadError,
      }, { status: 400 });
    }

    // Try to get signed URL for the uploaded file
    const { data: urlData, error: urlError } = await supabase.storage
      .from('meeting-files')
      .createSignedUrl(testFileName, 60); // 60 seconds expiry

    // Clean up test file
    await supabase.storage
      .from('meeting-files')
      .remove([testFileName]);

    if (urlError) {
      return Response.json({
        ok: false,
        error: `Signed URL generation failed: ${urlError.message}`,
        bucketInfo,
        uploadSuccess: true,
      }, { status: 400 });
    }

    return Response.json({
      ok: true,
      message: "Supabase Storage is configured correctly!",
      bucketInfo,
      uploadTest: {
        success: true,
        filePath: uploadData.path,
        signedUrlGenerated: !!urlData,
      },
    });

  } catch (error) {
    return toErrorResponse(error);
  }
}

// GET endpoint to check bucket status
export async function GET() {
  try {
    await requireUser();
    const supabase = createSupabaseServiceRoleClient();

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw new Error(`Failed to list buckets: ${bucketsError.message}`);
    }

    const meetingFilesBucket = buckets?.find(b => b.name === 'meeting-files');
    
    return Response.json({
      ok: true,
      bucketExists: !!meetingFilesBucket,
      bucketInfo: meetingFilesBucket ? {
        name: meetingFilesBucket.name,
        public: meetingFilesBucket.public,
        fileSizeLimit: meetingFilesBucket.fileSizeLimit,
        allowedMimeTypes: meetingFilesBucket.allowedMimeTypes,
        createdAt: meetingFilesBucket.created_at,
      } : null,
      allBuckets: buckets?.map(b => b.name) || [],
    });

  } catch (error) {
    return toErrorResponse(error);
  }
}


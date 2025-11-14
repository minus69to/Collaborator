import { SDK } from "@100mslive/server-sdk";
import { getServerEnv } from "@/lib/validateEnv";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const { HMS_ACCOUNT_ID, HMS_SECRET } = getServerEnv();

    // Verify env vars are present
    if (!HMS_ACCOUNT_ID || !HMS_SECRET) {
      return Response.json(
        {
          ok: false,
          error: "Missing HMS credentials",
          details: {
            hasAccountId: !!HMS_ACCOUNT_ID,
            hasSecret: !!HMS_SECRET,
            accountIdLength: HMS_ACCOUNT_ID?.length || 0,
            secretLength: HMS_SECRET?.length || 0,
          },
        },
        { status: 400 }
      );
    }

    // Debug: Show what we're actually reading
    const secretTrimmed = HMS_SECRET.trim();
    const hasWhitespace = HMS_SECRET !== secretTrimmed;
    const hasNewlines = HMS_SECRET.includes("\n") || HMS_SECRET.includes("\r");
    
    // Warn if secret looks like a token (too long) or has issues
    if (HMS_SECRET.length > 100 || hasWhitespace || hasNewlines) {
      return Response.json(
        {
          ok: false,
          error: "HMS_SECRET has issues",
          details: {
            message: HMS_SECRET.length > 100 
              ? "App Secret should be short (typically 24-32 characters). You might have put the Management Token instead. Please use the 'App Secret' from the 100ms Developer dashboard, not the Management Token."
              : "App Secret appears to have whitespace or newline characters. Please remove any spaces or line breaks.",
            secretLength: HMS_SECRET.length,
            secretTrimmedLength: secretTrimmed.length,
            secretFirstChars: HMS_SECRET.substring(0, 20),
            secretLastChars: HMS_SECRET.substring(Math.max(0, HMS_SECRET.length - 10)),
            hasWhitespace,
            hasNewlines,
            accountId: HMS_ACCOUNT_ID,
            accountIdLength: HMS_ACCOUNT_ID.length,
            note: "Check your .env.local file - make sure HMS_SECRET is on a single line with no quotes, spaces, or line breaks",
          },
        },
        { status: 400 }
      );
    }

    // Initialize SDK - use trimmed values to avoid whitespace issues
    const hms = new SDK(HMS_ACCOUNT_ID.trim(), HMS_SECRET.trim());

      // Try to list rooms to verify credentials work
      try {
        // This will make an API call that requires valid credentials
        // Call list() without params and just get the first room
        const roomsIterator = hms.rooms.list();
        const rooms: unknown[] = [];
        for await (const room of roomsIterator) {
          rooms.push(room);
          break; // Just get one room to verify it works
        }

      return Response.json({
        ok: true,
        message: "100ms connection successful!",
        details: {
          accountId: HMS_ACCOUNT_ID,
          accountIdLength: HMS_ACCOUNT_ID.length,
          secretLength: HMS_SECRET.length,
          secretFirstChars: HMS_SECRET.substring(0, 4) + "...",
          roomsFound: rooms.length,
        },
      });
    } catch (apiError: unknown) {
      const errorObj = apiError as { message?: string; response?: { data?: unknown; status?: number }; statusCode?: number };
      return Response.json(
        {
          ok: false,
          error: "Failed to authenticate with 100ms API",
          details: {
            message: errorObj?.message || String(apiError),
            response: errorObj?.response?.data || errorObj?.response,
            statusCode: errorObj?.response?.status || errorObj?.statusCode,
          },
          accountId: HMS_ACCOUNT_ID,
          accountIdLength: HMS_ACCOUNT_ID.length,
          secretLength: HMS_SECRET.length,
          secretFirstChars: HMS_SECRET.substring(0, 4) + "...",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}


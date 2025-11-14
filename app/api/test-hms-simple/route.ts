import { SDK } from "@100mslive/server-sdk";
import { getServerEnv } from "@/lib/validateEnv";

export async function GET() {
  try {
    const { HMS_ACCOUNT_ID, HMS_SECRET } = getServerEnv();

    // Show raw values (first/last few chars only for security)
    const accountIdPreview = HMS_ACCOUNT_ID.length > 10 
      ? `${HMS_ACCOUNT_ID.substring(0, 5)}...${HMS_ACCOUNT_ID.substring(HMS_ACCOUNT_ID.length - 5)}`
      : HMS_ACCOUNT_ID;

    const secretPreview = HMS_SECRET.length > 10
      ? `${HMS_SECRET.substring(0, 5)}...${HMS_SECRET.substring(HMS_SECRET.length - 5)}`
      : HMS_SECRET;

    // Try to initialize SDK
    let initError = null;
    
    try {
      const hms = new SDK(HMS_ACCOUNT_ID.trim(), HMS_SECRET.trim());
      
      // Try a simple API call - get management token (this validates credentials)
      const managementToken = await hms.auth.getManagementToken();
      
      return Response.json({
        ok: true,
        message: "✅ 100ms SDK initialized and credentials are valid!",
        details: {
          accountId: {
            value: accountIdPreview,
            length: HMS_ACCOUNT_ID.length,
            trimmed: HMS_ACCOUNT_ID.trim().length,
          },
          secret: {
            value: secretPreview,
            length: HMS_SECRET.length,
            trimmed: HMS_SECRET.trim().length,
            looksLikeToken: HMS_SECRET.length > 50 ? "⚠️ Looks like a token (too long for App Secret)" : "✅ Looks correct",
          },
          managementTokenGenerated: !!managementToken.token,
        },
      });
    } catch (error) {
      initError = error instanceof Error ? error.message : String(error);
      
      return Response.json({
        ok: false,
        error: "Failed to initialize 100ms SDK or validate credentials",
        details: {
          accountId: {
            value: accountIdPreview,
            length: HMS_ACCOUNT_ID.length,
          },
          secret: {
            value: secretPreview,
            length: HMS_SECRET.length,
            looksLikeToken: HMS_SECRET.length > 50 ? "⚠️ TOO LONG - This looks like a Management Token, not App Secret!" : "Length looks OK",
          },
          error: initError,
          recommendation: HMS_SECRET.length > 50 
            ? "Your HMS_SECRET is too long. App Secret should be ~24-32 characters. You likely put the Management Token instead. Use the 'App Secret' field from the Developer dashboard."
            : "Check that your App Access Key and App Secret are correct in .env.local",
        },
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({
      ok: false,
      error: "Failed to get environment variables",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }, { status: 500 });
  }
}


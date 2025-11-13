type ServerEnvKeys = "SUPABASE_SERVICE_ROLE_KEY" | "HMS_ACCOUNT_ID" | "HMS_SECRET" | "OPENAI_API_KEY";
type PublicEnvKeys = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_APP_URL";

type ServerEnv = Record<ServerEnvKeys, string>;
type PublicEnv = Record<PublicEnvKeys, string>;

let cachedServerEnv: ServerEnv | null = null;
let cachedPublicEnv: PublicEnv | null = null;

function ensurePresent<T extends string>(
  keys: readonly T[],
  source: Record<string, string | undefined>,
): Record<T, string> {
  return keys.reduce<Record<T, string>>((acc, key) => {
    const value = source[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    acc[key] = value;
    return acc;
  }, {} as Record<T, string>);
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv can only be used on the server.");
  }

  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = ensurePresent<ServerEnvKeys>(
    ["SUPABASE_SERVICE_ROLE_KEY", "HMS_ACCOUNT_ID", "HMS_SECRET", "OPENAI_API_KEY"],
    process.env,
  );

  return cachedServerEnv;
}

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!url) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!anonKey) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!appUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
  }

  cachedPublicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_APP_URL: appUrl,
  };

  return cachedPublicEnv;
}


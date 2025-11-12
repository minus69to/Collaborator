type ServerEnvKeys =
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "HMS_ACCOUNT_ID"
  | "HMS_SECRET"
  | "OPENAI_API_KEY";

type PublicEnvKeys =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_APP_URL";

type ServerEnv = Record<ServerEnvKeys, string>;
type PublicEnv = Record<PublicEnvKeys, string>;

type ValidatedEnv = ServerEnv & PublicEnv;

let cachedEnv: ValidatedEnv | null = null;

function ensurePresent<T extends string>(keys: readonly T[]): Record<T, string> {
  return keys.reduce<Record<T, string>>((acc, key) => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    acc[key] = value;
    return acc;
  }, {} as Record<T, string>);
}

export function validateEnv(): ValidatedEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const serverEnv = ensurePresent<ServerEnvKeys>([
    "SUPABASE_SERVICE_ROLE_KEY",
    "HMS_ACCOUNT_ID",
    "HMS_SECRET",
    "OPENAI_API_KEY",
  ]);

  const publicEnv = ensurePresent<PublicEnvKeys>([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL",
  ]);

  cachedEnv = { ...serverEnv, ...publicEnv };
  return cachedEnv;
}

export function getServerEnv(): ServerEnv {
  const env = validateEnv();
  return {
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    HMS_ACCOUNT_ID: env.HMS_ACCOUNT_ID,
    HMS_SECRET: env.HMS_SECRET,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
  };
}

export function getPublicEnv(): PublicEnv {
  const env = validateEnv();
  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
  };
}


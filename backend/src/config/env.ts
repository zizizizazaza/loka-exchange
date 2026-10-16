import { z } from 'zod';

/**
 * Environment variables, validated at startup. The app refuses to start if any is missing or malformed.
 * Secrets for later modules (the compliance key) are added here as those modules land.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),

  // Privy login. The verification key is public; when empty the SDK fetches it from Privy.
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_VERIFICATION_KEY: z.string().optional(),

  // ID Analyzer (docs/kyb.md). Optional so the rest of the app runs without them; KYB calls fail with 503 instead.
  IDANALYZER_API_KEY: z.string().optional(),
  /**
   * Optional key for the person checks (DocuPass ID sessions and AML screening), when they run on another
   * ID Analyzer account than the company check. Falls back to IDANALYZER_API_KEY. The KYC profile must belong
   * to this key's account.
   */
  IDANALYZER_KYC_API_KEY: z.string().optional(),
  IDANALYZER_BASE_URL: z.url().default('https://api2.idanalyzer.com'),
  /** The KYC profile DocuPass sessions run against (not a secret). */
  IDANALYZER_KYC_PROFILE_ID: z.string().optional(),
  IDANALYZER_WEBHOOK_SECRET: z.string().optional(),

  // Comma-separated origins allowed to call the API with credentials (cookies).
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return result.data;
}

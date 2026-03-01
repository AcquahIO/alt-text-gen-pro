import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(9090),
  APP_URL: z.string().url(),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_SCOPES: z.string().min(1),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1),
  BACKEND_API_BASE_URL: z.string().url().optional(),
  BACKEND_INTERNAL_API_KEY: z.string().optional(),
});

function parseScopes(input) {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${messages}`);
}

export const env = {
  ...parsed.data,
  APP_URL: parsed.data.APP_URL.replace(/\/+$/, ''),
  BACKEND_API_BASE_URL: parsed.data.BACKEND_API_BASE_URL?.replace(/\/+$/, ''),
  SHOPIFY_SCOPES: parseScopes(parsed.data.SHOPIFY_SCOPES),
};

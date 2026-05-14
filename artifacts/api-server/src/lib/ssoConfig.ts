import { logger } from "./logger";

/**
 * Centralised configuration for the OperatorOS SSO contract. All values come
 * from environment variables — see `docs/operatoros-sso.md` for the full list.
 *
 * `assertSsoConfigOrExit` is invoked at boot. In production the process exits
 * if `MODULE_SSO_SECRET` is missing or shorter than 16 characters, matching
 * the OperatorOS hard-fail requirement. In development we log a loud warning
 * but still allow the rest of the server to start so unrelated work isn't
 * blocked.
 */
export interface SsoConfig {
  secret: string;
  issuer: string;
  audience: string;
  env: string;
  apiUrl: string;
  consumeUrl: string;
}

export function getSsoConfig(): SsoConfig | null {
  const secret = process.env.MODULE_SSO_SECRET || "";
  const issuer = process.env.OPERATOROS_BASE_URL || "";
  const audience = (process.env.OPERATOROS_SSO_AUDIENCE || "").toLowerCase();
  const env = process.env.OPERATOROS_SSO_ENV || "";
  const apiUrl = process.env.OPERATOROS_API_URL || "";
  if (!secret || secret.length < 16) return null;
  if (!issuer || !audience || !env || !apiUrl) return null;
  const consumeUrl = `${apiUrl.replace(/\/+$/, "")}/v1/modules/sso/consume`;
  return { secret, issuer, audience, env, apiUrl, consumeUrl };
}

export function assertSsoConfigOrExit(): void {
  const isProd = process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production";
  const secret = process.env.MODULE_SSO_SECRET || "";
  const missing: string[] = [];
  if (!secret) missing.push("MODULE_SSO_SECRET");
  else if (secret.length < 16) missing.push("MODULE_SSO_SECRET (must be >= 16 chars)");
  if (!process.env.OPERATOROS_BASE_URL) missing.push("OPERATOROS_BASE_URL");
  if (!process.env.OPERATOROS_SSO_AUDIENCE) missing.push("OPERATOROS_SSO_AUDIENCE");
  if (!process.env.OPERATOROS_SSO_ENV) missing.push("OPERATOROS_SSO_ENV");
  if (!process.env.OPERATOROS_API_URL) missing.push("OPERATOROS_API_URL");
  if (missing.length === 0) return;
  if (isProd) {
    logger.fatal({ missing }, "OperatorOS SSO env config missing — refusing to start");
    process.exit(1);
  }
  logger.warn(
    { missing },
    "OperatorOS SSO env config incomplete; /sso endpoint will return 503 until configured",
  );
}

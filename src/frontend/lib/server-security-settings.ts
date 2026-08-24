type AppEnvironment = "local" | "test" | "staging" | "production";
export type CspMode = "report-only" | "enforce";

export type ServerSecuritySettings = {
  appEnvironment: AppEnvironment;
  cspMode: CspMode;
  cspSources: string[];
  cspReportUri?: string;
  trustedHttpsTermination: boolean;
  publicAppUrl?: string;
  hstsMaxAgeSeconds: number;
  trustedIngressSourceHeader?: string;
};

function list(value: string | undefined): string[] {
  return (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function isHttpsUrl(value: string | undefined): boolean {
  try {
    return Boolean(value && new URL(value).protocol === "https:");
  } catch {
    return false;
  }
}

export function getServerSecuritySettings(env = process.env): ServerSecuritySettings {
  const appEnvironment = (env.APP_ENV ?? "local") as AppEnvironment;
  if (!["local", "test", "staging", "production"].includes(appEnvironment)) {
    throw new Error("APP_ENV must be local, test, staging, or production");
  }

  const deployed = appEnvironment === "staging" || appEnvironment === "production";
  const cspMode = (env.CSP_MODE ?? (deployed ? "" : "report-only")) as CspMode;
  const cspSources = list(env.CSP_SOURCES ?? "'self'");
  const cspReportUri = env.CSP_REPORT_URI;
  const trustedHttpsTermination = env.TRUSTED_HTTPS_TERMINATION === "true";
  const hstsMaxAgeSeconds = Number(env.HSTS_MAX_AGE_SECONDS ?? "300");

  if (cspMode !== "report-only" && cspMode !== "enforce") {
    throw new Error("CSP_MODE must be report-only or enforce");
  }
  if (!Number.isInteger(hstsMaxAgeSeconds) || hstsMaxAgeSeconds < 0 || hstsMaxAgeSeconds > 31_536_000) {
    throw new Error("HSTS_MAX_AGE_SECONDS must be between 0 and 31536000");
  }
  if (deployed && (!cspSources.length || cspSources.some((source) => source.includes("*")))) {
    throw new Error("CSP_SOURCES must use explicit non-wildcard sources in staging and production");
  }
  if (deployed && cspMode === "report-only" && !isHttpsUrl(cspReportUri)) {
    throw new Error("CSP_REPORT_URI must be an HTTPS URL for deployed report-only mode");
  }
  if (trustedHttpsTermination && (!deployed || !isHttpsUrl(env.PUBLIC_APP_URL))) {
    throw new Error("TRUSTED_HTTPS_TERMINATION requires staging/production with an HTTPS PUBLIC_APP_URL");
  }

  return {
    appEnvironment,
    cspMode,
    cspSources,
    cspReportUri,
    trustedHttpsTermination,
    publicAppUrl: env.PUBLIC_APP_URL,
    hstsMaxAgeSeconds,
    trustedIngressSourceHeader: env.TRUSTED_INGRESS_SOURCE_HEADER,
  };
}

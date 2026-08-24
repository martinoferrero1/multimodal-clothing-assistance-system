import { type ServerSecuritySettings } from "./server-security-settings";

const CSP_HEADER = "Content-Security-Policy";
const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

function cspSources(settings: ServerSecuritySettings): string {
  return Array.from(new Set(["'self'", ...settings.cspSources])).join(" ");
}

function isHttpsUrl(value: string | undefined): boolean {
  try {
    return new URL(value ?? "").protocol === "https:";
  } catch {
    return false;
  }
}

export function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let value = "";
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }
  return btoa(value);
}

export function buildContentSecurityPolicy(settings: ServerSecuritySettings, nonce: string): string {
  const sources = cspSources(settings);
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${sources} 'nonce-${nonce}'`,
    `style-src ${sources} 'nonce-${nonce}'`,
    `img-src ${sources} data:`,
    `font-src ${sources}`,
    `connect-src ${sources}`,
  ];

  if (settings.cspReportUri) {
    directives.push(`report-uri ${settings.cspReportUri}`);
  }

  return directives.join("; ");
}

export function getSecurityPolicyHeaders(
  settings: ServerSecuritySettings,
  nonce: string,
): Headers {
  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), picture-in-picture=(), usb=()",
  });
  const cspHeader = settings.cspMode === "enforce" ? CSP_HEADER : CSP_REPORT_ONLY_HEADER;
  headers.set(cspHeader, buildContentSecurityPolicy(settings, nonce));

  if (
    (settings.appEnvironment === "staging" || settings.appEnvironment === "production")
    && settings.trustedHttpsTermination
    && isHttpsUrl(settings.publicAppUrl)
  ) {
    headers.set("Strict-Transport-Security", `max-age=${settings.hstsMaxAgeSeconds}`);
  }

  return headers;
}

export function applySecurityPolicyHeaders(response: Response, headers: Headers): Response {
  headers.forEach((value, name) => response.headers.set(name, value));
  return response;
}

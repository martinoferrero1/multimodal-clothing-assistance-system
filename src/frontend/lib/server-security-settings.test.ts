import assert from "node:assert/strict";
import test from "node:test";

import { getServerSecuritySettings } from "./server-security-settings";

test("local HTTP settings use safe defaults", () => {
  const settings = getServerSecuritySettings({ APP_ENV: "local" });

  assert.equal(settings.cspMode, "report-only");
  assert.equal(settings.trustedHttpsTermination, false);
  assert.equal(settings.hstsMaxAgeSeconds, 300);
});

test("deployed settings require explicit non-wildcard CSP sources", () => {
  assert.throws(
    () => getServerSecuritySettings({ APP_ENV: "production", CSP_MODE: "enforce", CSP_SOURCES: "*" }),
    /CSP_SOURCES/,
  );
});

test("deployed report-only settings require HTTPS reporting", () => {
  assert.throws(
    () => getServerSecuritySettings({
      APP_ENV: "staging",
      CSP_MODE: "report-only",
      CSP_SOURCES: "'self'",
      CSP_REPORT_URI: "http://reports.example",
    }),
    /CSP_REPORT_URI/,
  );
});

test("HTTPS termination requires deployed HTTPS configuration", () => {
  assert.throws(
    () => getServerSecuritySettings({
      APP_ENV: "local",
      CSP_MODE: "enforce",
      TRUSTED_HTTPS_TERMINATION: "true",
      PUBLIC_APP_URL: "http://localhost:3000",
    }),
    /TRUSTED_HTTPS_TERMINATION/,
  );
});

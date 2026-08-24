import assert from "node:assert/strict";
import test from "node:test";

import {
  applySecurityPolicyHeaders,
  buildContentSecurityPolicy,
  createCspNonce,
  getSecurityPolicyHeaders,
} from "./server-security-policy";
import { getServerSecuritySettings } from "./server-security-settings";

test("enforced policy protects page and static responses with one CSP header", () => {
  const settings = getServerSecuritySettings({
    APP_ENV: "local",
    CSP_MODE: "enforce",
    CSP_SOURCES: "https://images.example",
  });
  const nonce = createCspNonce();
  const headers = getSecurityPolicyHeaders(settings, nonce);

  assert.equal(headers.get("content-security-policy-report-only"), null);
  assert.ok((headers.get("content-security-policy") ?? "").includes(`'nonce-${nonce}'`));
  assert.match(headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("permissions-policy") ?? "", /camera=\(\)/);

  const page = applySecurityPolicyHeaders(new Response("page"), headers);
  const asset = applySecurityPolicyHeaders(new Response("asset"), headers);
  assert.equal(page.headers.get("content-security-policy"), asset.headers.get("content-security-policy"));
});

test("report-only mode emits only the report-only response header", () => {
  const settings = getServerSecuritySettings({
    APP_ENV: "local",
    CSP_MODE: "report-only",
    CSP_REPORT_URI: "https://reports.example/csp",
  });
  const policy = buildContentSecurityPolicy(settings, "test-nonce");
  const headers = getSecurityPolicyHeaders(settings, "test-nonce");

  assert.equal(headers.get("content-security-policy"), null);
  assert.equal(headers.get("content-security-policy-report-only"), policy);
  assert.match(policy, /report-uri https:\/\/reports\.example\/csp/);
});

test("HSTS is emitted only for confirmed deployed HTTPS", () => {
  const local = getServerSecuritySettings({ APP_ENV: "local", CSP_MODE: "enforce" });
  const production = getServerSecuritySettings({
    APP_ENV: "production",
    CSP_MODE: "enforce",
    CSP_SOURCES: "'self'",
    PUBLIC_APP_URL: "https://lookeate.example",
    TRUSTED_HTTPS_TERMINATION: "true",
    HSTS_MAX_AGE_SECONDS: "300",
  });

  assert.equal(getSecurityPolicyHeaders(local, "nonce").get("strict-transport-security"), null);
  assert.equal(
    getSecurityPolicyHeaders(production, "nonce").get("strict-transport-security"),
    "max-age=300",
  );
});

test("deployed HSTS rejects untrusted HTTP termination", () => {
  assert.throws(
    () => getServerSecuritySettings({
      APP_ENV: "staging",
      CSP_MODE: "enforce",
      CSP_SOURCES: "'self'",
      PUBLIC_APP_URL: "http://lookeate.example",
      TRUSTED_HTTPS_TERMINATION: "true",
    }),
    /TRUSTED_HTTPS_TERMINATION/,
  );
});

test("proxy response retains body, upstream metadata, and separate cookies", async () => {
  const settings = getServerSecuritySettings({ APP_ENV: "local", CSP_MODE: "enforce" });
  const response = new Response("streamed body", {
    status: 201,
    headers: [
      ["content-type", "text/event-stream"],
      ["set-cookie", "session=one; Path=/; HttpOnly"],
      ["set-cookie", "csrf=two; Path=/"],
    ],
  });
  const secured = applySecurityPolicyHeaders(response, getSecurityPolicyHeaders(settings, "nonce"));

  assert.equal(secured.status, 201);
  assert.equal(secured.headers.get("content-type"), "text/event-stream");
  assert.deepEqual(secured.headers.getSetCookie(), [
    "session=one; Path=/; HttpOnly",
    "csrf=two; Path=/",
  ]);
  assert.equal(await secured.text(), "streamed body");
});

import assert from "node:assert/strict";
import test from "node:test";

import { confirmStoreMfa, registerStore, setCsrfToken, verifyStoreEmail } from "./api-client";

test("store onboarding calls stay same-origin and use only the runtime CSRF value", async () => {
  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ path: String(input), init });
    const body = String(input).endsWith("verify-email")
      ? {
          user: {
            id: "owner", display_name: "Owner", email: "owner@example.com",
            search_preferences: { priority_fields: [] },
            style_preferences: { use_personalized_styles: true, explicit: {}, inferred: [] },
            created_at: "2026-08-25T00:00:00Z",
          },
          csrf_token: "session-bound-csrf",
          selected_store: null,
        }
      : { accepted: true };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };

  try {
    setCsrfToken("runtime-only-csrf");
    await registerStore({
      owner_display_name: "Owner", owner_email: "owner@example.com", owner_password: "password123",
      legal_name: "Owner LLC", display_name: "Owner", handle: "owner-store", jurisdiction: "ES",
      business_identifier: "ES-123", address: "Main Street 1", contact_email: "contact@example.com",
      contact_phone: "+34123456789",
    });
    await verifyStoreEmail("one-time-verification-value");
    await confirmStoreMfa("123456");

    assert.deepEqual(requests.map(({ path }) => path), [
      "/api/proxy/api/auth/store/register",
      "/api/proxy/api/auth/store/verify-email",
      "/api/proxy/api/auth/store/mfa/confirm",
    ]);
    for (const { init } of requests) {
      assert.equal(init?.credentials, "same-origin");
      assert.equal(new Headers(init?.headers).get("x-csrf-token"), "runtime-only-csrf");
    }
    assert.equal(String(requests[0].init?.body).includes("owner_password"), true);
    assert.equal(String(requests[1].init?.body).includes("one-time-verification-value"), true);
  } finally {
    setCsrfToken(null);
    globalThis.fetch = originalFetch;
  }
});

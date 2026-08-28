import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { GET, POST } from "./route";


test("proxy overwrites spoofed source and preserves security and rate-limit evidence", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment: Record<string, string | undefined> = {
    APP_ENV: process.env.APP_ENV,
    CSP_MODE: process.env.CSP_MODE,
    TRUSTED_INGRESS_SOURCE_HEADER: process.env.TRUSTED_INGRESS_SOURCE_HEADER,
  };
  process.env.APP_ENV = "test";
  process.env.CSP_MODE = "enforce";
  process.env.TRUSTED_INGRESS_SOURCE_HEADER = "x-trusted-client-source";

  let upstreamHeaders: Headers | undefined;
  globalThis.fetch = (async (_input, init) => {
    upstreamHeaders = new Headers(init?.headers);
    return new Response('{"detail":"Too many requests."}', {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": "17",
      },
    });
  }) as typeof fetch;

  try {
    const request = new NextRequest("http://localhost:3000/api/proxy/api/auth/login", {
      method: "POST",
      headers: {
        accept: "application/json",
        cookie: "lookeate_session=opaque-token",
        "content-type": "application/json",
        origin: "http://localhost:3000",
        referer: "http://localhost:3000/login",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "csrf-evidence",
        "x-forwarded-for": "10.0.0.8",
        "x-lookeate-client-source": "browser-spoof",
        "x-trusted-client-source": " 198.51.100.27 ",
      },
      body: JSON.stringify({ email: "person@example.com", password: "password123" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["api", "auth", "login"] }),
    });

    assert.equal(upstreamHeaders?.get("x-lookeate-client-source"), "198.51.100.27");
    assert.equal(upstreamHeaders?.get("x-forwarded-for"), null);
    assert.equal(upstreamHeaders?.get("x-trusted-client-source"), null);
    assert.equal(upstreamHeaders?.get("cookie"), "lookeate_session=opaque-token");
    assert.equal(upstreamHeaders?.get("origin"), "http://localhost:3000");
    assert.equal(upstreamHeaders?.get("referer"), "http://localhost:3000/login");
    assert.equal(upstreamHeaders?.get("x-csrf-token"), "csrf-evidence");
    assert.equal(upstreamHeaders?.get("sec-fetch-site"), "same-origin");
    assert.equal(upstreamHeaders?.get("sec-fetch-mode"), "cors");
    assert.equal(upstreamHeaders?.get("sec-fetch-dest"), "empty");
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "17");
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(await response.text(), '{"detail":"Too many requests."}');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("proxy smoke covers authentication and assistant request paths", async () => {
  const originalFetch = globalThis.fetch;
  const originalAppEnv = process.env.APP_ENV;
  const requestedUrls: string[] = [];
  process.env.APP_ENV = "test";
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof fetch;

  const cases = [
    { method: "POST", path: ["api", "auth", "login"], contentType: "application/json" },
    { method: "POST", path: ["api", "auth", "register"], contentType: "application/json" },
    { method: "GET", path: ["api", "auth", "session"], contentType: undefined },
    { method: "POST", path: ["api", "auth", "store", "register"], contentType: "application/json" },
    { method: "POST", path: ["api", "auth", "store", "verify-email"], contentType: "application/json" },
    { method: "GET", path: ["api", "auth", "store", "status"], contentType: undefined },
    { method: "POST", path: ["api", "auth", "store", "mfa", "enroll"], contentType: "application/json" },
    { method: "POST", path: ["api", "auth", "store", "mfa", "confirm"], contentType: "application/json" },
    { method: "POST", path: ["api", "conversations", "one", "messages"], contentType: "application/json" },
    { method: "POST", path: ["api", "conversations", "one", "messages", "stream"], contentType: "application/json" },
    { method: "POST", path: ["api", "conversations", "one", "messages", "with-images"], contentType: "multipart/form-data; boundary=test" },
  ] as const;

  try {
    for (const requestCase of cases) {
      const request = new NextRequest(
        `http://localhost:3000/api/proxy/${requestCase.path.join("/")}`,
        {
          method: requestCase.method,
          headers: {
            origin: "http://localhost:3000",
            "sec-fetch-site": "same-origin",
            ...(requestCase.contentType ? { "content-type": requestCase.contentType } : {}),
          },
          body: requestCase.method === "POST" ? "{}" : undefined,
        },
      );
      const context = { params: Promise.resolve({ path: requestCase.path.slice() as string[] }) };
      const response = requestCase.method === "GET"
        ? await GET(request, context)
        : await POST(request, context);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "ok");
    }

    assert.deepEqual(
      requestedUrls.map((url) => new URL(url).pathname),
      cases.map((requestCase) => `/${requestCase.path.join("/")}`),
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }
  }
});

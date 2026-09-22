import assert from "node:assert/strict";
import test from "node:test";
import {
  Transport,
  ApiError,
  type CredentialStore,
} from "../src/core/transport";
import { validateConfig } from "../src/core/config";

const config = validateConfig(
  "http://127.0.0.1:8000",
  "http://localhost:3000",
  "lookeate_session",
  true,
);
function harness(fetcher: typeof fetch) {
  let stored: string | null = null;
  let expired = 0;
  const credentials: CredentialStore = {
    read: async () => stored,
    write: async (value) => {
      stored = value;
    },
    clear: async () => {
      stored = null;
    },
  };
  const client = new Transport(config, credentials, fetcher);
  client.onExpired = () => {
    expired++;
  };
  return { client, credentials, stored: () => stored, expired: () => expired };
}
test("login stores only the configured opaque cookie; mutations send cookie, origin and CSRF", async () => {
  const calls: RequestInit[] = [];
  const h = harness(async (_url, init) => {
    calls.push(init!);
    return calls.length === 1
      ? Response.json(
          { csrf_token: "csrf" },
          {
            headers: {
              "Set-Cookie":
                "lookeate_session=opaque-value; HttpOnly; Path=/; Max-Age=100",
            },
          },
        )
      : new Response(null, { status: 204 });
  });
  const result = await h.client.request<{ csrf_token: string }>(
    "api/auth/login",
    {
      method: "POST",
      body: { email: "test@example.com", password: "test-password" },
    },
  );
  h.client.setCsrf(result.csrf_token);
  await h.client.request("api/conversations/example", { method: "DELETE" });
  assert.equal(h.stored(), "lookeate_session=opaque-value");
  const headers = new Headers(calls[1].headers);
  assert.equal(headers.get("Cookie"), h.stored());
  assert.equal(headers.get("X-CSRF-Token"), "csrf");
  assert.equal(headers.get("Origin"), config.origin);
  assert.equal(calls[0].credentials, "omit");
  assert.equal(calls[0].redirect, "error");
});
test("expired sessions clear credentials, notify UI and do not expose response contents", async () => {
  const h = harness(async () =>
    Response.json({ detail: "sensitive server internals" }, { status: 401 }),
  );
  await h.credentials.write("lookeate_session=expired");
  h.client.setCsrf("old");
  await assert.rejects(
    h.client.request("api/auth/session"),
    (e: ApiError) => e.status === 401 && !e.message.includes("sensitive"),
  );
  assert.equal(h.stored(), null);
  assert.equal(h.expired(), 1);
});
test("network failures and rejected CSRF do not simulate logout", async () => {
  const h = harness(async () => new Response(null, { status: 403 }));
  await h.credentials.write("lookeate_session=valid");
  await assert.rejects(h.client.request("api/auth/logout", { method: "POST" }));
  assert.equal(h.stored(), "lookeate_session=valid");
  assert.equal(h.expired(), 0);
});
test("successful server logout clears its deletion cookie", async () => {
  const h = harness(
    async () =>
      new Response(null, {
        status: 204,
        headers: { "Set-Cookie": 'lookeate_session=""; Max-Age=0; Path=/' },
      }),
  );
  await h.credentials.write("lookeate_session=valid");
  await h.client.request("api/auth/logout", { method: "POST" });
  assert.equal(h.stored(), null);
});
test("a late unauthorized response cannot clear a newly rotated session", async () => {
  let resolveOld!: (value: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const old = new Promise<Response>((resolve) => {
    resolveOld = resolve;
  });
  const h = harness(async (url) => {
    if (String(url).endsWith("session")) {
      started();
      return old;
    }
    return Response.json(
      {},
      { headers: { "Set-Cookie": "lookeate_session=new-session; HttpOnly" } },
    );
  });
  const stale = h.client.request("api/auth/session");
  await ready;
  await h.client.request("api/auth/login", { method: "POST" });
  resolveOld(new Response(null, { status: 401 }));
  await assert.rejects(stale, (e: ApiError) => e.status === 409);
  assert.equal(h.stored(), "lookeate_session=new-session");
  assert.equal(h.expired(), 0);
});
test("multipart leaves boundary generation to fetch", async () => {
  const h = harness(async (_url, init) => {
    assert.equal(new Headers(init!.headers).has("Content-Type"), false);
    assert.ok(init!.body instanceof FormData);
    return Response.json({});
  });
  const form = new FormData();
  form.append("content", "hello");
  await h.client.request("api/conversations/id/messages/with-images", {
    method: "POST",
    form,
  });
});
test("foreign cookies and off-origin paths are rejected or ignored", async () => {
  const h = harness(async () =>
    Response.json({}, { headers: { "Set-Cookie": "foreign=secret; Path=/" } }),
  );
  await h.client.request("api/auth/session");
  await h.client.request("api/catalog/products?query=blue+shirt&limit=12");
  assert.equal(h.stored(), null);
  await assert.rejects(h.client.request("https://foreign.example/api"));
  await assert.rejects(h.client.request("api/../private"));
});
test("release configuration requires HTTPS, explicit origin and host-only secure cookie name", () => {
  assert.throws(() => validateConfig(undefined, undefined, undefined, true));
  assert.throws(() =>
    validateConfig(config.apiUrl, config.origin, config.cookieName, false),
  );
  assert.throws(() =>
    validateConfig(
      "https://api.example.com",
      "https://app.example.com/path",
      "__Host-session",
      false,
    ),
  );
  assert.throws(() =>
    validateConfig(
      "https://user:pass@api.example.com",
      "https://app.example.com",
      "__Host-session",
      false,
    ),
  );
  assert.throws(() =>
    validateConfig(
      "https://api.example.com",
      "https://app.example.com",
      "session",
      false,
    ),
  );
  assert.equal(
    validateConfig(
      "https://api.example.com",
      "https://app.example.com",
      "__Host-session",
      false,
    ).cookieName,
    "__Host-session",
  );
});

import { NextRequest, NextResponse } from "next/server";

import {
  applySecurityPolicyHeaders,
  buildContentSecurityPolicy,
  createCspNonce,
  getSecurityPolicyHeaders,
} from "@/lib/server-security-policy";
import { getServerSecuritySettings } from "@/lib/server-security-settings";

export function proxy(request: NextRequest) {
  const settings = getServerSecuritySettings();
  const nonce = createCspNonce();
  const requestHeaders = new Headers(request.headers);

  // Next.js reads the request CSP to add the nonce to rendered framework scripts.
  requestHeaders.set("content-security-policy", buildContentSecurityPolicy(settings, nonce));
  requestHeaders.set("x-nonce", nonce);

  return applySecurityPolicyHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    getSecurityPolicyHeaders(settings, nonce),
  );
}

export const config = {
  matcher: "/:path*",
};

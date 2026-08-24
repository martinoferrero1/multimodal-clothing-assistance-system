import { NextRequest } from "next/server";
import {
  applySecurityPolicyHeaders,
  createCspNonce,
  getSecurityPolicyHeaders,
} from "@/lib/server-security-policy";
import { getServerSecuritySettings } from "@/lib/server-security-settings";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
const PRIVATE_SOURCE_HEADER = "x-lookeate-client-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const nextPath = path.join("/");
  const search = request.nextUrl.search || "";
  const targetUrl = `${API_BASE_URL}/${nextPath}${search}`;

  const headers = new Headers();
  for (const header of [
    "cookie", "content-type", "accept", "origin", "referer", "x-csrf-token",
    "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest",
  ]) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  const trustedIngressHeader = getServerSecuritySettings().trustedIngressSourceHeader;
  if (trustedIngressHeader) {
    const source = request.headers.get(trustedIngressHeader);
    if (source) {
      headers.set(PRIVATE_SOURCE_HEADER, source.trim().slice(0, 128));
    }
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    duplex: "half",
    cache: "no-store",
  } as RequestInit & { duplex: "half" });

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  }
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) {
    responseHeaders.set("retry-after", retryAfter);
  }
  const setCookies = typeof upstream.headers.getSetCookie === "function"
    ? upstream.headers.getSetCookie()
    : upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie") as string] : [];
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  const response = new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  const settings = getServerSecuritySettings();
  return applySecurityPolicyHeaders(response, getSecurityPolicyHeaders(settings, createCspNonce()));
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, context);
}

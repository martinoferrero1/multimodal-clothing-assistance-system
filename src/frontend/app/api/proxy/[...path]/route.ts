import { NextRequest } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

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

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : Buffer.from(await request.arrayBuffer());

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: body ? body : undefined,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  }
  const setCookies = typeof upstream.headers.getSetCookie === "function"
    ? upstream.headers.getSetCookie()
    : upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie") as string] : [];
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
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

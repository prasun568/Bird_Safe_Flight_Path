import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const BACKEND_BASE_URL = process.env.PY_BACKEND_URL ?? "http://127.0.0.1:8000";

export async function requireAuth(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me" });
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function forwardJson(request: NextRequest, path: string, init?: RequestInit) {
  const url = new URL(path, BACKEND_BASE_URL);
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Accept: "application/json",
    },
  });

  const contentType = response.headers.get("content-type") ?? "application/json";
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}

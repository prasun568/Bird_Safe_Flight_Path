import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PATHS = ["/console"];
const AUTH_PATHS = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me" });

  const isProtected = PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAuthPage = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/console", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/console/:path*", "/login", "/signup"],
};

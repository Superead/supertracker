import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const path = request.nextUrl.pathname;

  if (path === "/login" || path === "/dashboard" || path.startsWith("/api")) {
    return NextResponse.next();
  }

  if (!token && (path.startsWith("/agent") || path.startsWith("/admin"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

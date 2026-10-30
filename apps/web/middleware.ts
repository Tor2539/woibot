import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/teammate", "/work", "/tasks", "/files", "/computer", "/routines", "/apps", "/team", "/settings"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("wb_session")?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/teammate/:path*", "/work/:path*", "/tasks/:path*", "/files/:path*", "/computer/:path*", "/routines/:path*", "/apps/:path*", "/team/:path*", "/settings/:path*"],
};

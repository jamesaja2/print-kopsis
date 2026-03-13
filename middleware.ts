import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
  "/signin",
  "/signup",
  "/api/health",
  "/api/kiosk",
  "/api/print/payment/webhook",
  "/api/cron/orders-cleanup",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const REMOVED_MODULE_PATHS = [
  "/voting",
  "/voting-results",
  "/submissions",
  "/products",
  "/inventory",
  "/my-products",
  "/my-inventory",
  "/my-payout",
  "/resources",
  "/link-in-bio",
  "/register",
  "/booths",
  "/payouts",
  "/content",
];

function isRemovedModulePath(pathname: string) {
  return REMOVED_MODULE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (isRemovedModulePath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, data: {}, message: "Module removed" },
        { status: 410 }
      );
    }
    return NextResponse.redirect(new URL("/print/orders", req.url));
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/signin", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/signin" && token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};

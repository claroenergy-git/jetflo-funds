import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

const isDemoMode = process.env.DEMO_MODE === "true";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (isDemoMode) {
    const demoCookie = request.cookies.get("jetflo_demo_user_id")?.value;
    if (!demoCookie && !request.nextUrl.pathname.startsWith("/login")) {
      response.cookies.set("jetflo_demo_user_id", "44444444-4444-4444-4444-444444444444", {
        path: "/",
        maxAge: 86400,
      });
    }
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const isPublicAsset =
    pathname.endsWith(".csv") ||
    pathname.endsWith(".xlsx") ||
    pathname.endsWith(".pdf") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg");

  if (isPublicAsset) {
    return response;
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isLogin = pathname.startsWith("/login");
  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv|xlsx|pdf)$).*)"],
};

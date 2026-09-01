import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
const isDemoMode =
  process.env.DEMO_MODE === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("placeholder");

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (isDemoMode) {
    const demoCookie = request.cookies.get("jetflo_demo_user_id")?.value;
    if (!demoCookie && !request.nextUrl.pathname.startsWith("/login")) {
      // Default to Leadership demo user if no cookie set yet
      response.cookies.set("jetflo_demo_user_id", "44444444-4444-4444-4444-444444444444", {
        path: "/",
        maxAge: 86400,
      });
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

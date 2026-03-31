import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildForbiddenRedirect,
  buildLoginRedirect,
  canAccessRoute,
  getDefaultRouteForRole,
  getRoleFromMetadata,
  isAuthRoute,
  isProtectedRoute,
} from "@/lib/route-access";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof supabaseResponse.cookies.set>[2] }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  /**
   * NOTE: Role is read from Supabase user_metadata for UI routing only.
   * This is intentionally best-effort and is not used as an authorization source.
   * Backend routes always enforce role/permission checks against database state.
   */
  const role = getRoleFromMetadata(user?.user_metadata?.role);

  if (!user && isProtectedRoute(path)) {
    return NextResponse.redirect(
      new URL(buildLoginRedirect(path, request.nextUrl.search), request.url)
    );
  }

  if (user && isAuthRoute(path)) {
    return NextResponse.redirect(
      new URL(getDefaultRouteForRole(role), request.url)
    );
  }

  // If metadata role is missing, allow navigation and let backend remain authoritative.
  if (user && !role) {
    return supabaseResponse;
  }

  if (user && !canAccessRoute(path, role)) {
    return NextResponse.redirect(
      new URL(
        buildForbiddenRedirect(role, `${path}${request.nextUrl.search}`),
        request.url
      )
    );
  }

  return supabaseResponse;
}

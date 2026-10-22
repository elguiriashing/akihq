import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";
import { isTrustedBusinessHost } from "@/lib/public-request-origin";
import {
  businessRoute,
  scrubBusinessHandoffQuery,
} from "@/lib/business-routing";

export async function middleware(request: NextRequest) {
  if (!isTrustedBusinessHost(request.headers.get("host") || ""))
    return new NextResponse(null, { status: 421 });
  request.headers.delete("x-akipasa-membership-next");
  request.headers.set("x-akipasa-product", "akibusiness");
  request.headers.set(
    "x-akipasa-locale",
    request.nextUrl.pathname.split("/")[1] === "en" ? "en" : "es",
  );
  const route = businessRoute(request.nextUrl.pathname, request.method);
  if (route.kind === "reject") return new NextResponse(null, { status: 404 });
  if (route.kind === "primary" || route.kind === "redirect") {
    if (!["GET", "HEAD"].includes(request.method))
      return new NextResponse(null, { status: 404 });
    const url = request.nextUrl.clone();
    url.pathname = route.path;
    if (route.kind === "primary") {
      url.hostname = "akipasa.com";
      url.protocol = "https:";
      url.port = "";
      scrubBusinessHandoffQuery(url.searchParams);
      url.hash = "redirected";
      if (/\/(membership|memberships|account)(\/|$)/.test(route.path))
        url.searchParams.set("from", "akibusiness");
    }
    return NextResponse.redirect(url, route.kind === "redirect" ? 308 : 307);
  }
  const response = await refreshSession(request);
  if (request.nextUrl.pathname !== "/")
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

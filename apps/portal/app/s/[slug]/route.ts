import { NextResponse, type NextRequest } from "next/server";
import { isValidSlug } from "@kmf/core";
import { CHOSEN_SCHOOL_COOKIE, findSchoolBySlug, getTenant } from "@/lib/tenant";

/**
 * Opens a school on a platform address that has no school subdomain,
 * e.g. kmf-schools.vercel.app/s/brightfield. The choice is remembered in this
 * browser until /leave-school. On a school's own address this does nothing extra.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug.toLowerCase();
  const home = new URL("/", request.url);

  const tenant = await getTenant();
  if (tenant.kind === "school" && !tenant.chosenByPath) return NextResponse.redirect(new URL("/login", request.url));

  const school = isValidSlug(slug) ? await findSchoolBySlug(slug) : null;
  if (!school) return NextResponse.redirect(new URL("/?school=not-found", request.url));

  const response = NextResponse.redirect(new URL("/login", home));
  response.cookies.set(CHOSEN_SCHOOL_COOKIE, school.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

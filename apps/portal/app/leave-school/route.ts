import { NextResponse, type NextRequest } from "next/server";
import { DEMO_ROLE_COOKIE } from "@/lib/demo";
import { CHOSEN_SCHOOL_COOKIE } from "@/lib/tenant";

/** Forgets the school opened with /s/<slug> and returns to the KMF Schools page. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(CHOSEN_SCHOOL_COOKIE);
  response.cookies.delete(DEMO_ROLE_COOKIE);
  return response;
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function expectedToken() {
  const secret = process.env.VIEW_PASSWORD || "bonitaaa";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("anita-view"));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function same(given: string, expected: string) {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < given.length; index += 1) {
    diff |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

export async function middleware(request: NextRequest) {
  const given = request.cookies.get("anita-view")?.value ?? "";
  if (same(given, await expectedToken())) return NextResponse.next();
  return new NextResponse(null, { status: 401 });
}

export const config = {
  matcher: ["/photos/:path*"],
};

import { NextResponse } from "next/server";
import { requestCanView, viewPasswordOk, viewToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function cookie(response: NextResponse, request: Request, maxAge?: number) {
  response.cookies.set({
    name: "anita-view",
    value: maxAge === 0 ? "" : viewToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    ...(maxAge === 0 ? { maxAge: 0 } : {}),
  });
}

export async function GET(request: Request) {
  const response = NextResponse.json(
    { ok: requestCanView(request) },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (requestCanView(request)) cookie(response, request);
  return response;
}

export async function POST(request: Request) {
  if (new URL(request.url).searchParams.get("exit") === "1") {
    const response = NextResponse.json({ ok: true });
    cookie(response, request, 0);
    return response;
  }

  const body = (await request.json()) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!viewPasswordOk(password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  cookie(response, request);
  return response;
}

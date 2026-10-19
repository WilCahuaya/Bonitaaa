import { NextResponse } from "next/server";
import { passwordOk } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!passwordOk(password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

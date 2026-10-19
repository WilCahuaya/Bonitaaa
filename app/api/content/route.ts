import { NextResponse } from "next/server";
import { passwordOk } from "@/lib/auth";
import { listAudioIds, readLetter, writeLetter } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [letter, audios] = await Promise.all([readLetter(), listAudioIds()]);
  return NextResponse.json(
    { letter, audios },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!passwordOk(request.headers.get("x-edit-key"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as { letter?: unknown };
  if (typeof body.letter !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const letter = body.letter.slice(0, 5000);
  try {
    await writeLetter(letter);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, letter });
}

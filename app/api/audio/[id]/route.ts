import { NextResponse } from "next/server";
import { mediaResponse, sniffAudioType } from "@/lib/audio-response";
import { passwordOk, requestCanView } from "@/lib/auth";
import { isAudioId, readAudio, saveAudio } from "@/lib/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  if (!requestCanView(request)) return new NextResponse(null, { status: 401 });

  const { id } = await context.params;
  if (!isAudioId(id)) return new NextResponse(null, { status: 404 });

  const audio = await readAudio(id);
  if (!audio) return new NextResponse(null, { status: 404 });

  const bytes = new Uint8Array(audio.data);
  return mediaResponse(request, bytes, sniffAudioType(bytes));
}

export async function HEAD(request: Request, context: Context) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}

export async function POST(request: Request, context: Context) {
  if (!passwordOk(request.headers.get("x-edit-key"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isAudioId(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "grande" }, { status: 413 });
  }

  await saveAudio(id, file);
  return NextResponse.json({ ok: true });
}

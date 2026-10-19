import { NextResponse } from "next/server";
import { passwordOk } from "@/lib/auth";
import { audioContentType, isPhotoId, readAudio, saveAudio } from "@/lib/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!isPhotoId(id)) return new NextResponse(null, { status: 404 });

  const audio = await readAudio(id);
  if (!audio) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(audio.data), {
    headers: {
      "Content-Type": audioContentType(audio.ext),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request, context: Context) {
  if (!passwordOk(request.headers.get("x-edit-key"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isPhotoId(id)) return NextResponse.json({ ok: false }, { status: 404 });

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

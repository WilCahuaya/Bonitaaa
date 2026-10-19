export function sniffAudioType(data: Uint8Array) {
  const text = (start: number, length: number) => {
    let value = "";
    for (let index = 0; index < length && start + index < data.length; index += 1) {
      value += String.fromCharCode(data[start + index]);
    }
    return value;
  };

  if (text(0, 4) === "RIFF" && text(8, 4) === "WAVE") return "audio/wav";
  if (text(0, 4) === "OggS") return "audio/ogg";
  if (text(0, 3) === "ID3") return "audio/mpeg";
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (text(4, 4) === "ftyp") return "audio/mp4";
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return "audio/webm";
  return "application/octet-stream";
}

export function mediaResponse(request: Request, data: Uint8Array, contentType: string) {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const size = bytes.byteLength;
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
  });

  const requested = request.headers.get("range")?.split(",")[0]?.trim() ?? "";
  if (!requested) {
    headers.set("Content-Length", String(size));
    return new Response(bytes, { status: 200, headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
  if (!match || size === 0) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = match[1] === "" ? 0 : Number(match[1]);
  let end = match[2] === "" ? size - 1 : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  end = Math.min(end, size - 1);
  const chunk = bytes.slice(start, end + 1);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(chunk.byteLength));
  return new Response(chunk, { status: 206, headers });
}

import { mkdir, readdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const audioDir = path.join(dataDir, "audios");
const letterPath = path.join(dataDir, "letter.txt");

const AUDIO_EXTS = ["webm", "mp3", "m4a", "mp4", "ogg", "wav", "aac"] as const;

const MIME_EXT: Record<string, (typeof AUDIO_EXTS)[number]> = {
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "video/webm": "webm",
};

export function isPhotoId(id: string) {
  return /^(0[1-9]|1\d|2[0-4])$/.test(id);
}

export async function readLetter() {
  try {
    return await readFile(letterPath, "utf8");
  } catch {
    return "";
  }
}

export async function writeLetter(letter: string) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(letterPath, letter, "utf8");
}

export async function listAudioIds() {
  try {
    const files = await readdir(audioDir);
    return files
      .map((file) => {
        const match = file.match(/^(0[1-9]|1\d|2[0-4])\.(webm|mp3|m4a|mp4|ogg|wav|aac)$/i);
        return match ? match[1] : null;
      })
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

export async function readAudio(id: string) {
  for (const ext of AUDIO_EXTS) {
    try {
      const filePath = path.join(audioDir, `${id}.${ext}`);
      const data = await readFile(filePath);
      return { data, ext };
    } catch {
      continue;
    }
  }
  return null;
}

export async function saveAudio(id: string, file: File) {
  const mime = file.type.split(";")[0].toLowerCase();
  const ext = MIME_EXT[mime] ?? "webm";
  await mkdir(audioDir, { recursive: true });
  await Promise.all(
    AUDIO_EXTS.map(async (oldExt) => {
      try {
        await unlink(path.join(audioDir, `${id}.${oldExt}`));
      } catch {
        return;
      }
    }),
  );
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(audioDir, `${id}.${ext}`), bytes);
  return ext;
}

export function audioContentType(ext: string) {
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "mp4":
    case "aac":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    default:
      return "audio/webm";
  }
}

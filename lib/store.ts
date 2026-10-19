import { mkdir, readdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import { getStore } from "@netlify/blobs";

const dataDir = path.join(process.cwd(), "data");
const audioDir = path.join(dataDir, "audios");
const letterPath = path.join(dataDir, "letter.txt");
const STORE_NAME = "anitaaa";

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

function onNetlify() {
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT,
  );
}

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export function isPhotoId(id: string) {
  return /^(0[1-9]|1\d|2[0-4])$/.test(id);
}

async function readLetterFile() {
  try {
    return await readFile(letterPath, "utf8");
  } catch {
    return "";
  }
}

export async function readLetter() {
  if (!onNetlify()) return readLetterFile();

  const blobs = store();
  const saved = await blobs.get("letter", { type: "text" });
  if (typeof saved === "string") return saved;

  const seeded = await readLetterFile();
  if (seeded) await blobs.set("letter", seeded);
  return seeded;
}

export async function writeLetter(letter: string) {
  if (!onNetlify()) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(letterPath, letter, "utf8");
    return;
  }

  await store().set("letter", letter);
}

export async function listAudioIds() {
  if (!onNetlify()) {
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

  const { blobs } = await store().list({ prefix: "audio/" });
  return blobs
    .map((blob) => blob.key.slice("audio/".length))
    .filter((id) => isPhotoId(id));
}

export async function readAudio(id: string) {
  if (!onNetlify()) {
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

  const entry = await store().getWithMetadata(`audio/${id}`, { type: "arrayBuffer" });
  if (!entry?.data) return null;
  const ext = typeof entry.metadata?.ext === "string" ? entry.metadata.ext : "webm";
  return { data: Buffer.from(entry.data), ext };
}

export async function saveAudio(id: string, file: File) {
  const mime = file.type.split(";")[0].toLowerCase();
  const ext = MIME_EXT[mime] ?? "webm";
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!onNetlify()) {
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
    await writeFile(path.join(audioDir, `${id}.${ext}`), bytes);
    return ext;
  }

  await store().set(`audio/${id}`, file, { metadata: { ext } });
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

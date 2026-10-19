import { createHmac, timingSafeEqual } from "crypto";

const VIEW_COOKIE = "anita-view";

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function passwordOk(given: string | null | undefined) {
  return sameSecret(given ?? "", process.env.EDIT_PASSWORD || "willl");
}

export function viewPasswordOk(given: string | null | undefined) {
  return sameSecret(given ?? "", process.env.VIEW_PASSWORD || "bonitaaa");
}

export function viewToken() {
  const secret = process.env.VIEW_PASSWORD || "bonitaaa";
  return createHmac("sha256", secret).update(VIEW_COOKIE).digest("hex");
}

export function requestCanView(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)anita-view=([^;]+)/);
  if (!match) return false;
  return sameSecret(decodeURIComponent(match[1]), viewToken());
}

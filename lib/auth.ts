import { timingSafeEqual } from "crypto";

export function passwordOk(given: string | null | undefined) {
  const expected = process.env.EDIT_PASSWORD || "willl";
  const input = given ?? "";
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

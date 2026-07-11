import { clearSessionCookie } from "../../../../lib/auth";

export async function POST() {
  await clearSessionCookie();
  return globalThis.Response.json({ ok: true });
}

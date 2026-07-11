import { getAdminCredentials, getSessionUser } from "../../../../lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return globalThis.Response.json({ user: null, adminCredentials: getAdminCredentials() });
  }

  return globalThis.Response.json({ user });
}

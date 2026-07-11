import { authenticateUser, setSessionCookie } from "../../../../lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body.email ?? "";
    const password = body.password ?? "";

    if (!email.trim() || !password) {
      return globalThis.Response.json({ error: "Enter both email and password." }, { status: 400 });
    }

    const result = authenticateUser(email, password);
    if (result.error) {
      return globalThis.Response.json({ error: result.error }, { status: 401 });
    }

    await setSessionCookie(result.user.id);
    return globalThis.Response.json({ user: result.user });
  } catch {
    return globalThis.Response.json({ error: "Unable to sign in." }, { status: 500 });
  }
}

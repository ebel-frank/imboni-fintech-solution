import { registerUser, setSessionCookie } from "../../../../lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = body.name ?? "";
    const organization = body.organization ?? "";
    const role = body.role ?? "Credit officer";
    const email = body.email ?? "";
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (!name.trim() || !organization.trim() || !email.trim()) {
      return globalThis.Response.json({ error: "Complete all required fields." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return globalThis.Response.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const result = registerUser({ name, organization, role, email, password });
    if (result.error) {
      return globalThis.Response.json({ error: result.error }, { status: 400 });
    }

    await setSessionCookie(result.user.id);
    return globalThis.Response.json({ user: result.user }, { status: 201 });
  } catch {
    return globalThis.Response.json({ error: "Unable to create account." }, { status: 500 });
  }
}

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";

const SESSION_COOKIE = "imboni_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ADMIN_ACCOUNT = {
  id: "admin-credit-desk",
  name: "Imboni Admin",
  organization: "Imboni Credit Desk",
  role: "Admin",
  email: "admin@imboni.rw",
  password: "Imboni2026!",
};

function getDataDir() {
  const dir = join(process.cwd(), "..", "data", "runtime");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getUsersPath() {
  return join(getDataDir(), "users.json");
}

function getSessionsPath() {
  return join(getDataDir(), "sessions.json");
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf-8");
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function readUsers() {
  return readJson(getUsersPath(), []);
}

function writeUsers(users) {
  writeJson(getUsersPath(), users);
}

function readSessions() {
  return readJson(getSessionsPath(), {});
}

function writeSessions(sessions) {
  writeJson(getSessionsPath(), sessions);
}

export function ensureAdminUser() {
  const users = readUsers();
  const email = normalizeEmail(ADMIN_ACCOUNT.email);

  if (users.some((user) => normalizeEmail(user.email) === email)) {
    return users;
  }

  const adminUser = {
    id: ADMIN_ACCOUNT.id,
    name: ADMIN_ACCOUNT.name,
    organization: ADMIN_ACCOUNT.organization,
    role: ADMIN_ACCOUNT.role,
    email,
    passwordHash: hashPassword(ADMIN_ACCOUNT.password),
    createdAt: new Date().toISOString(),
  };

  const nextUsers = [adminUser, ...users];
  writeUsers(nextUsers);
  return nextUsers;
}

export function registerUser({ name, organization, role, email, password }) {
  ensureAdminUser();
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();

  if (users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
    return { error: "An account already exists for that email." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    organization: organization.trim(),
    role,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  writeUsers([newUser, ...users]);
  return { user: sanitizeUser(newUser) };
}

export function authenticateUser(email, password) {
  ensureAdminUser();
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const user = users.find((storedUser) => normalizeEmail(storedUser.email) === normalizedEmail);
  const passwordHash = hashPassword(password);

  if (!user || user.passwordHash !== passwordHash) {
    return { error: "Invalid email or password." };
  }

  return { user: sanitizeUser(user) };
}

function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const sessions = readSessions();
  sessions[token] = {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
  };
  writeSessions(sessions);
  return token;
}

export async function setSessionCookie(userId) {
  const token = createSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const sessions = readSessions();
    delete sessions[token];
    writeSessions(sessions);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  ensureAdminUser();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessions = readSessions();
  const session = sessions[token];
  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) {
    delete sessions[token];
    writeSessions(sessions);
    return null;
  }

  const users = readUsers();
  const user = users.find((storedUser) => storedUser.id === session.userId);
  return user ? sanitizeUser(user) : null;
}

export function getAdminCredentials() {
  return {
    email: ADMIN_ACCOUNT.email,
    password: ADMIN_ACCOUNT.password,
  };
}

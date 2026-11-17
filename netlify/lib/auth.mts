import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { shop } from "./store.mts";

/* One owner account. The password is stored only as a salted scrypt hash.
   Sessions are signed cookies; changing the password signs everyone out. */

const COOKIE = "ggz_owner";
const WEEK = 7 * 24 * 60 * 60 * 1000;

type Owner = {
  email: string; salt: string; hash: string; version: number;
  usedCode: string; fails: number; lockedUntil: number;
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const scrypt = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const equal = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const readOwner = () => shop().get("owner", { type: "json" }) as Promise<Owner | null>;

async function secret(): Promise<string> {
  const saved = await shop().get("secret");
  if (saved) return saved;
  const fresh = randomBytes(32).toString("hex");
  const written = await shop().set("secret", fresh, { onlyIfNew: true });
  return written.modified ? fresh : ((await shop().get("secret")) as string);
}

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

async function cookieFor(owner: Owner, req: Request) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + WEEK, v: owner.version })).toString("base64url");
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${payload}.${sign(payload, await secret())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${WEEK / 1000}${secure}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export async function signedIn(req: Request): Promise<Owner | null> {
  const match = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (!match) return null;
  const [payload, mark] = match[1].split(".");
  if (!payload || !mark || !equal(mark, sign(payload, await secret()))) return null;
  try {
    const { exp, v } = JSON.parse(Buffer.from(payload, "base64url").toString());
    const owner = await readOwner();
    return owner && exp > Date.now() && v === owner.version ? owner : null;
  } catch {
    return null;
  }
}

export function passwordProblem(password: unknown) {
  if (typeof password !== "string" || password.length < 10) return "Choose a password of at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  return "";
}

/* First-time setup, and password recovery: both need the setup code the site owner holds.
   A code works once. To recover a lost password, set a new ADMIN_SETUP_CODE and redeploy. */
export async function setup(req: Request, email: string, password: string, code: string) {
  const expected = Netlify.env.get("ADMIN_SETUP_CODE") || "";
  if (expected.length < 12) return { error: "Setup is not switched on for this site yet." };
  if (typeof code !== "string" || !equal(sha(code.trim()), sha(expected))) return { error: "That setup code is not right." };
  const existing = await readOwner();
  if (existing && existing.usedCode === sha(expected)) return { error: "That setup code has already been used. Sign in instead." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const salt = randomBytes(16).toString("hex");
  const owner: Owner = {
    email: email.toLowerCase(), salt, hash: scrypt(password, salt),
    version: (existing?.version || 0) + 1, usedCode: sha(expected), fails: 0, lockedUntil: 0,
  };
  await shop().setJSON("owner", owner);
  return { cookie: await cookieFor(owner, req), email: owner.email };
}

export async function login(req: Request, email: string, password: string) {
  const owner = await readOwner();
  if (!owner) return { error: "No owner account exists yet. Use your setup code first." };
  if (owner.lockedUntil > Date.now()) {
    return { error: `Too many wrong tries. Wait ${Math.ceil((owner.lockedUntil - Date.now()) / 60000)} minutes and try again.` };
  }
  const right = typeof email === "string" && typeof password === "string" && password.length <= 200 &&
    equal(sha(email.trim().toLowerCase()), sha(owner.email)) && equal(scrypt(password, owner.salt), owner.hash);
  if (!right) {
    const fails = owner.fails + 1;
    await shop().setJSON("owner", { ...owner, fails, lockedUntil: fails >= 5 ? Date.now() + 15 * 60000 : 0 });
    return { error: "That email or password is not right." };
  }
  if (owner.fails) await shop().setJSON("owner", { ...owner, fails: 0, lockedUntil: 0 });
  return { cookie: await cookieFor(owner, req), email: owner.email };
}

export async function changePassword(req: Request, owner: Owner, current: string, next: string) {
  if (typeof current !== "string" || !equal(scrypt(current.slice(0, 200), owner.salt), owner.hash)) {
    return { error: "Your current password is not right." };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  const salt = randomBytes(16).toString("hex");
  const updated = { ...owner, salt, hash: scrypt(next, salt), version: owner.version + 1 };
  await shop().setJSON("owner", updated);
  return { cookie: await cookieFor(updated, req) };
}

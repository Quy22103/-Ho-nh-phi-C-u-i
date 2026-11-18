import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { serverConfig } from '../config/env.ts';
import type { UserAccountSafe } from '../../src/types/archive.ts';

export interface StoredUserRecord {
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'REVIEWER';
  can_publish: boolean;
  is_locked: boolean;
  password_hash: string;
  created_at: string;
  last_login_at?: string;
}

export interface SessionPayload {
  sid: string;
  uid: string;
  role: 'ADMIN' | 'REVIEWER';
  exp: number;
}

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

const failedLoginTracker = new Map<
  string,
  { count: number; firstAttemptAt: number; lockedUntil: number }
>();

const revokedSessionIds = new Set<string>();
let cachedSecret: string | null = null;

async function getSessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (serverConfig.sessionSecretEnv) {
    cachedSecret = serverConfig.sessionSecretEnv;
    return cachedSecret;
  }

  try {
    const existing = await fs.readFile(
      serverConfig.sessionSecretFilePath,
      'utf8'
    );
    if (existing.trim().length >= 32) {
      cachedSecret = existing.trim();
      return cachedSecret;
    }
  } catch {
    // Generate new cryptographic secret on first boot
  }

  const generated = crypto.randomBytes(48).toString('hex');
  await fs.mkdir(path.dirname(serverConfig.sessionSecretFilePath), {
    recursive: true,
  });
  await fs.writeFile(serverConfig.sessionSecretFilePath, generated, {
    encoding: 'utf8',
    mode: 0o600,
  });
  cachedSecret = generated;
  return cachedSecret;
}

async function readUsers(): Promise<StoredUserRecord[]> {
  try {
    const raw = await fs.readFile(serverConfig.usersFilePath, 'utf8');
    const parsed = JSON.parse(raw) as { users?: StoredUserRecord[] };
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeUsers(users: StoredUserRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(serverConfig.usersFilePath), { recursive: true });
  await fs.writeFile(
    serverConfig.usersFilePath,
    JSON.stringify({ users }, null, 2),
    'utf8'
  );
}

export function toSafeUser(user: StoredUserRecord): UserAccountSafe {
  return {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    can_publish: user.role === 'ADMIN' ? true : Boolean(user.can_publish),
    is_locked: Boolean(user.is_locked),
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  };
}

export async function needsInitialAdminSetup(): Promise<boolean> {
  const users = await readUsers();
  return users.length === 0;
}

export async function bootstrapAdminFromEnvIfConfigured(): Promise<void> {
  const users = await readUsers();
  if (users.length > 0) return;

  const username = (process.env.ADMIN_BOOTSTRAP_USERNAME || '').trim();
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
  if (!username || !email || password.length < 8) return;

  await createInitialAdminAccount({
    username,
    email,
    full_name: 'Quản trị viên hệ thống',
    password,
  });
}

export async function createInitialAdminAccount(params: {
  username: string;
  email: string;
  full_name: string;
  password: string;
}): Promise<UserAccountSafe> {
  const users = await readUsers();
  if (users.length > 0) {
    throw new Error('ALREADY_INITIALIZED');
  }

  const username = params.username.trim().toLowerCase();
  const email = params.email.trim().toLowerCase();
  const fullName = params.full_name.trim() || username;

  if (!username || username.length < 3) {
    throw new Error('Tên đăng nhập tối thiểu 3 ký tự.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Email không hợp lệ.');
  }
  if (!params.password || params.password.length < 8) {
    throw new Error('Mật khẩu quản trị phải có tối thiểu 8 ký tự.');
  }

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const newUser: StoredUserRecord = {
    user_id: `USR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    username,
    email,
    full_name: fullName,
    role: 'ADMIN',
    can_publish: true,
    is_locked: false,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };

  await writeUsers([newUser]);
  return toSafeUser(newUser);
}

function getAttemptKey(ip: string, identifier: string): string {
  return `${ip}::${identifier.toLowerCase().trim()}`;
}

export function checkLoginRateLimit(ip: string, identifier: string): {
  blocked: boolean;
  retryMinutes: number;
} {
  const key = getAttemptKey(ip, identifier);
  const entry = failedLoginTracker.get(key);
  if (!entry) return { blocked: false, retryMinutes: 0 };

  const now = Date.now();
  if (entry.lockedUntil > now) {
    return {
      blocked: true,
      retryMinutes: Math.max(1, Math.ceil((entry.lockedUntil - now) / 60000)),
    };
  }

  if (now - entry.firstAttemptAt > LOCK_WINDOW_MS) {
    failedLoginTracker.delete(key);
  }
  return { blocked: false, retryMinutes: 0 };
}

function recordFailedLogin(ip: string, identifier: string): void {
  const key = getAttemptKey(ip, identifier);
  const now = Date.now();
  const existing = failedLoginTracker.get(key);
  if (!existing || now - existing.firstAttemptAt > LOCK_WINDOW_MS) {
    failedLoginTracker.set(key, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
    });
    return;
  }
  const nextCount = existing.count + 1;
  failedLoginTracker.set(key, {
    count: nextCount,
    firstAttemptAt: existing.firstAttemptAt,
    lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCK_WINDOW_MS : 0,
  });
}

function clearFailedLogin(ip: string, identifier: string): void {
  failedLoginTracker.delete(getAttemptKey(ip, identifier));
}

export async function authenticateUser(params: {
  identifier: string;
  password: string;
  ip: string;
}): Promise<{ user: UserAccountSafe; token: string; expMs: number }> {
  const identifier = params.identifier.trim().toLowerCase();
  const rate = checkLoginRateLimit(params.ip, identifier);
  if (rate.blocked) {
    throw new Error(`RATE_LIMITED:${rate.retryMinutes}`);
  }

  const users = await readUsers();
  const found = users.find(
    (u) => u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier
  );

  if (!found) {
    recordFailedLogin(params.ip, identifier);
    throw new Error('INVALID_CREDENTIALS');
  }

  if (found.is_locked) {
    throw new Error('ACCOUNT_LOCKED');
  }

  const matched = await bcrypt.compare(params.password, found.password_hash);
  if (!matched) {
    recordFailedLogin(params.ip, identifier);
    throw new Error('INVALID_CREDENTIALS');
  }

  clearFailedLogin(params.ip, identifier);

  found.last_login_at = new Date().toISOString();
  await writeUsers(users);

  const ttlMs = serverConfig.sessionTtlHours * 60 * 60 * 1000;
  const expMs = Date.now() + ttlMs;
  const payload: SessionPayload = {
    sid: crypto.randomBytes(16).toString('hex'),
    uid: found.user_id,
    role: found.role,
    exp: expMs,
  };
  const token = await signSessionToken(payload);

  return { user: toSafeUser(found), token, expMs };
}

async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secret = await getSessionSecret();
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ payload: SessionPayload; user: UserAccountSafe } | null> {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const secret = await getSessionSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');

  const bufA = Buffer.from(sig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload?.uid || !payload?.sid || Date.now() > payload.exp) {
    return null;
  }
  if (revokedSessionIds.has(payload.sid)) {
    return null;
  }

  const users = await readUsers();
  const user = users.find((u) => u.user_id === payload.uid);
  if (!user || user.is_locked) {
    return null;
  }

  return { payload, user: toSafeUser(user) };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token || !token.includes('.')) return;
  try {
    const [encoded] = token.split('.');
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (payload?.sid) revokedSessionIds.add(payload.sid);
  } catch {
    // Ignore malformed token on logout
  }
}

export async function listAllUsers(): Promise<UserAccountSafe[]> {
  const users = await readUsers();
  return users.map(toSafeUser);
}

export async function createUserAccount(params: {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role: 'ADMIN' | 'REVIEWER';
  can_publish: boolean;
}): Promise<UserAccountSafe> {
  const users = await readUsers();
  const username = params.username.trim().toLowerCase();
  const email = params.email.trim().toLowerCase();

  if (!username || username.length < 3) {
    throw new Error('Tên đăng nhập tối thiểu 3 ký tự.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Email không hợp lệ.');
  }
  if (!params.password || params.password.length < 8) {
    throw new Error('Mật khẩu phải có tối thiểu 8 ký tự.');
  }
  if (
    users.some(
      (u) =>
        u.username.toLowerCase() === username || u.email.toLowerCase() === email
    )
  ) {
    throw new Error('Tên đăng nhập hoặc email đã tồn tại.');
  }

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const created: StoredUserRecord = {
    user_id: `USR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    username,
    email,
    full_name: params.full_name.trim() || username,
    role: params.role === 'ADMIN' ? 'ADMIN' : 'REVIEWER',
    can_publish:
      params.role === 'ADMIN' ? true : Boolean(params.can_publish),
    is_locked: false,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };

  users.push(created);
  await writeUsers(users);
  return toSafeUser(created);
}

export async function updateUserAccount(
  userId: string,
  updates: {
    full_name?: string;
    email?: string;
    role?: 'ADMIN' | 'REVIEWER';
    can_publish?: boolean;
    is_locked?: boolean;
    new_password?: string;
  },
  actorUserId: string
): Promise<{ before: UserAccountSafe; after: UserAccountSafe }> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.user_id === userId);
  if (idx === -1) {
    throw new Error('Không tìm thấy tài khoản.');
  }

  const target = users[idx];
  const before = toSafeUser(target);

  if (userId === actorUserId && updates.is_locked === true) {
    throw new Error('Không thể tự khóa tài khoản quản trị đang đăng nhập.');
  }
  if (userId === actorUserId && updates.role === 'REVIEWER') {
    throw new Error('Không thể tự hạ quyền tài khoản đang đăng nhập.');
  }

  if (typeof updates.full_name === 'string' && updates.full_name.trim()) {
    target.full_name = updates.full_name.trim();
  }
  if (typeof updates.email === 'string' && updates.email.trim()) {
    const nextEmail = updates.email.trim().toLowerCase();
    if (!nextEmail.includes('@')) throw new Error('Email không hợp lệ.');
    if (
      users.some(
        (u) => u.user_id !== userId && u.email.toLowerCase() === nextEmail
      )
    ) {
      throw new Error('Email đã được sử dụng bởi tài khoản khác.');
    }
    target.email = nextEmail;
  }
  if (updates.role === 'ADMIN' || updates.role === 'REVIEWER') {
    target.role = updates.role;
    if (updates.role === 'ADMIN') target.can_publish = true;
  }
  if (typeof updates.can_publish === 'boolean' && target.role !== 'ADMIN') {
    target.can_publish = updates.can_publish;
  }
  if (typeof updates.is_locked === 'boolean') {
    target.is_locked = updates.is_locked;
  }
  if (updates.new_password && updates.new_password.trim()) {
    if (updates.new_password.trim().length < 8) {
      throw new Error('Mật khẩu mới phải có tối thiểu 8 ký tự.');
    }
    target.password_hash = await bcrypt.hash(
      updates.new_password.trim(),
      BCRYPT_ROUNDS
    );
  }

  users[idx] = target;
  await writeUsers(users);
  return { before, after: toSafeUser(target) };
}

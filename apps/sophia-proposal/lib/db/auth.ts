/**
 * Custom JWT Auth — replaces Supabase Auth
 *
 * Uses Web Crypto API (available in CF Workers) for password hashing
 * and JWT token signing/verification.
 */

import { getD1Client } from './client';
import type { User } from './client';

const JWT_SECRET=REDACTED = process.env.JWT_SECRET=REDACTED ?? process.env.INTERNAL_API_SECRET ?? 'sophia-jwt-secret-change-me';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// JWT helpers using Web Crypto (CF Workers compatible)
async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncode(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): unknown {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(padded));
}

async function createJwt(payload: Record<string, unknown>): Promise<string> {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECONDS,
  });
  const signature = await hmacSign(`${header}.${body}`, JWT_SECRET=REDACTED);
  return `${header}.${body}.${signature}`;
}

async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;

    const expected = await hmacSign(`${header}.${body}`, JWT_SECRET=REDACTED);
    if (expected !== signature) return null;

    const payload = base64UrlDecode(body) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

// Password hashing using Web Crypto (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256,
  );
  const hash = new Uint8Array(derived);
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hash).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, storedHashHex] = stored.split(':');
  if (!saltHex || !storedHashHex) return false;

  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256,
  );
  const hashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHashHex;
}

// Public API — same signatures as old Supabase auth module

export async function getCurrentUser(cookies: string): Promise<User | null> {
  try {
    const cookieMap = new URLSearchParams(cookies.replace(/; /g, '&'));
    const token = cookieMap.get('auth-token') ?? cookieMap.get('sb-token');
    if (!token) return null;

    const payload = await verifyJwt(token);
    if (!payload?.sub) return null;

    const db = await getD1Client();
    const { data } = await db.from('users').select('id, email, full_name, avatar_url, role').eq('id', payload.sub).single();
    return data as User | null;
  } catch {
    return null;
  }
}

export async function signUp(
  email: string, password: string,
): Promise<{ user: User | null; token?: string; error: string | null }> {
  try {
    const db = await getD1Client();

    // Check if email already exists
    const { data: existing } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return { user: null, error: 'Email already registered' };

    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();

    await db.from('users').insert({
      id, email, password_hash: passwordHash, role: 'user',
    });

    const user: User = { id, email, role: 'user' };
    const token = await createJwt({ sub: id, email });
    return { user, token, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

export async function signIn(
  email: string, password: string,
): Promise<{ user: User | null; token?: string; error: string | null }> {
  try {
    const db = await getD1Client();
    const { data } = await db
      .from('users')
      .select('id, email, full_name, avatar_url, role, password_hash')
      .eq('email', email)
      .single();

    if (!data) return { user: null, error: 'Invalid credentials' };

    const row = data as Record<string, string>;
    if (!row.password_hash || !(await verifyPassword(password, row.password_hash))) {
      return { user: null, error: 'Invalid credentials' };
    }

    // Update last_sign_in_at
    await db.from('users').update({ last_sign_in_at: new Date().toISOString() }).eq('id', row.id);

    const user: User = { id: row.id, email: row.email, full_name: row.full_name, avatar_url: row.avatar_url, role: row.role };
    const token = await createJwt({ sub: row.id, email: row.email });
    return { user, token, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  try {
    const db = await getD1Client();
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) {
      // Create user if not exists
      await db.from('users').insert({ email, magic_link_token: token, magic_link_expires_at: expires });
    } else {
      await db.from('users').update({ magic_link_token: token, magic_link_expires_at: expires }).eq('email', email);
    }

    // In production: send email via CF Workers Email or external service
    console.log(`[auth] Magic link token for ${email}: ${token}`);
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function verifyMagicLink(
  token: string,
): Promise<{ user: User | null; authToken?: string; error: string | null }> {
  try {
    const db = await getD1Client();
    const { data } = await db
      .from('users')
      .select('id, email, full_name, role, magic_link_expires_at')
      .eq('magic_link_token', token)
      .single();

    if (!data) return { user: null, error: 'Invalid or expired magic link' };

    const row = data as Record<string, string>;
    if (new Date(row.magic_link_expires_at) < new Date()) {
      return { user: null, error: 'Magic link expired' };
    }

    // Clear token and mark verified
    await db.from('users').update({
      magic_link_token: null, magic_link_expires_at: null,
      email_verified: 1, last_sign_in_at: new Date().toISOString(),
    }).eq('id', row.id);

    const user: User = { id: row.id, email: row.email, full_name: row.full_name, role: row.role };
    const authToken = await createJwt({ sub: row.id, email: row.email });
    return { user, authToken, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

export async function signOut(_accessToken: string): Promise<{ error: string | null }> {
  // Stateless JWT — client just deletes the cookie
  // For token blacklisting, could use KV store
  return { error: null };
}

export async function createOrganization(
  userId: string, name: string, slug: string,
): Promise<{ orgId: string | null; error: string | null }> {
  try {
    const db = await getD1Client();
    const orgId = crypto.randomUUID();

    await db.from('organizations').insert({ id: orgId, name, slug });
    await db.from('org_members').insert({ org_id: orgId, user_id: userId, role: 'owner' });
    // Create initial balance
    await db.from('org_balances').insert({ org_id: orgId, balance: 0 });

    return { orgId, error: null };
  } catch (e) {
    return { orgId: null, error: (e as Error).message };
  }
}

export async function getUserOrganization(
  userId: string,
): Promise<{ id: string; name: string; slug: string; role: string } | null> {
  try {
    const db = await getD1Client();
    const { data: member } = await db
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    if (!member) return null;
    const m = member as Record<string, string>;

    const { data: org } = await db
      .from('organizations')
      .select('id, name, slug')
      .eq('id', m.org_id)
      .single();

    if (!org) return null;
    const o = org as Record<string, string>;

    return { id: o.id, name: o.name, slug: o.slug, role: m.role };
  } catch {
    return null;
  }
}

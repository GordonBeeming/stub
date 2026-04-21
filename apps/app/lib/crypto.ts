import { customAlphabet } from 'nanoid';

// Base58-ish alphabet: no 0/O/1/l/I to avoid handwritten/OCR ambiguity.
const SLUG_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SLUG_LENGTH = 10;

export const slug = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

export function newSlug(length: number = SLUG_LENGTH): string {
  return customAlphabet(SLUG_ALPHABET, length)();
}

// 32 bytes of randomness, URL-safe base64 (no padding). Used for magic-link
// tokens — the raw value is emailed once, only the sha256 hash lives in D1.
export function randomUrlSafeToken(bytes: number = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Byte-oriented aliases. The existing helpers above already operate on
// Uint8Array, but exporting these names makes call sites in the notes code
// read clearly — `base64UrlEncodeBytes(ciphertext)` is less ambiguous than
// `base64UrlEncode(ciphertext)` when the file also deals with string tokens.
export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return base64UrlEncode(bytes);
}

export function base64UrlDecodeToBytes(input: string): Uint8Array {
  return base64UrlDecode(input);
}

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(digest);
}

export async function hashIP(ip: string, salt: string): Promise<string> {
  // IP + rotating daily salt keeps per-day uniqueness without retaining raw IPs.
  return sha256Hex(`${ip}:${salt}`);
}

// Constant-time hex string compare. Both inputs must be hex of equal length;
// a length mismatch short-circuits to false — safe because length isn't secret.
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === undefined) continue;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

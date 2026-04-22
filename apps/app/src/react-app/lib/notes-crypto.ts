// Client-side AES-GCM for burn notes. The server never sees the key — it
// lives in the URL fragment (`#k=…`) and stays in the browser.

const KEY_BITS = 256;
export const KEY_BYTES = KEY_BITS / 8;
export const IV_BYTES = 12;
const ALG = 'AES-GCM';

export interface EncryptedBundle {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  rawKey: Uint8Array;
}

// WebCrypto's BufferSource narrowed to ArrayBuffer-backed views. A plain
// Uint8Array<ArrayBufferLike> isn't assignable across all target types, so
// copy into an owned ArrayBuffer for the crypto API calls.
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

export async function encryptPlaintext(text: string): Promise<EncryptedBundle> {
  const rawKey = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(rawKey);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);

  const key = await crypto.subtle.importKey('raw', toBuffer(rawKey), { name: ALG }, false, ['encrypt']);
  const plaintext = new TextEncoder().encode(text);
  const buf = await crypto.subtle.encrypt({ name: ALG, iv: toBuffer(iv) }, key, toBuffer(plaintext));
  return { ciphertext: new Uint8Array(buf), iv, rawKey };
}

export async function decryptCiphertext(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  rawKey: Uint8Array,
): Promise<string> {
  if (rawKey.length !== KEY_BYTES) throw new Error('invalid key length');
  if (iv.length !== IV_BYTES) throw new Error('invalid iv length');
  const key = await crypto.subtle.importKey('raw', toBuffer(rawKey), { name: ALG }, false, ['decrypt']);
  const buf = await crypto.subtle.decrypt({ name: ALG, iv: toBuffer(iv) }, key, toBuffer(ciphertext));
  return new TextDecoder().decode(buf);
}

// Client-side AES-GCM for burn notes. The server never sees the key — it
// lives in the URL fragment (`#k=…`) and stays in the browser. The folder
// is `_notes` (underscore prefix) so Next's App Router treats it as a
// private folder and never maps it to a route.

// 256-bit keys give us 32 raw bytes, which base64url-encodes to 43 chars.
// A 12-byte IV is the AES-GCM sweet spot (matches what WebCrypto expects
// without any internal rehashing).
const KEY_BITS = 256;
const KEY_BYTES = KEY_BITS / 8;
const IV_BYTES = 12;
const ALG = 'AES-GCM';

export { KEY_BYTES, IV_BYTES };

export interface EncryptedBundle {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  key: CryptoKey;
  rawKey: Uint8Array;
}

// WebCrypto's BufferSource narrowed to ArrayBuffer-backed views in the
// Cloudflare types. `Uint8Array<ArrayBufferLike>` (the default from new
// Uint8Array) isn't assignable, so we hand it an ArrayBuffer slice to be
// safe across worker/browser typings without any unsafe casts.
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
  return {
    ciphertext: new Uint8Array(buf),
    iv,
    key,
    rawKey,
  };
}

export async function decryptCiphertext(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  rawKey: Uint8Array,
): Promise<string> {
  if (rawKey.length !== KEY_BYTES) {
    throw new Error('invalid key length');
  }
  if (iv.length !== IV_BYTES) {
    throw new Error('invalid iv length');
  }
  const key = await crypto.subtle.importKey('raw', toBuffer(rawKey), { name: ALG }, false, ['decrypt']);
  const buf = await crypto.subtle.decrypt({ name: ALG, iv: toBuffer(iv) }, key, toBuffer(ciphertext));
  return new TextDecoder().decode(buf);
}

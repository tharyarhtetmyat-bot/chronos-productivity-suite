/**
 * CryptoEngine — AES-GCM 256 primitives (Web Crypto API).
 * Design: each account has one random data key (DEK). The DEK is wrapped
 * (encrypted) twice: by a key derived from the password and by a key derived
 * from the recovery word. Changing/resetting a password only re-wraps the DEK,
 * so stored data never needs re-encryption and is never lost.
 */
const CryptoEngine = {
  ITER: 600000, // PBKDF2-SHA256 work factor for new wraps (OWASP guidance)

  b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
  unb64: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
  rand: (n) => crypto.getRandomValues(new Uint8Array(n)),

  async kek(secret, salt, iter = this.ITER) {
    const mat = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, mat,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async seal(bytes, key) {
    const iv = this.rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv); out.set(ct, 12);
    return this.b64(out);
  },
  async open(text, key) {
    const b = this.unb64(text);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12)));
  },
  importDek: (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']),

  async wrap(raw, secret) {
    const salt = this.rand(16);
    return { salt: this.b64(salt), iter: this.ITER, blob: await this.seal(raw, await this.kek(secret, salt)) };
  },
  async unwrap(w, secret) {
    try { return await this.open(w.blob, await this.kek(secret, this.unb64(w.salt), w.iter)); }
    catch { return null; } // wrong secret or tampered data (GCM auth failure)
  },

  encryptData: (data, dek) => CryptoEngine.seal(new TextEncoder().encode(JSON.stringify(data)), dek),
  async decryptData(text, dek) {
    try { return JSON.parse(new TextDecoder().decode(await this.open(text, dek))); }
    catch { return null; }
  },

  /** Reads records written by Chronos < 7 (per-record PBKDF2 key from password). */
  async legacyDecrypt(text, password) {
    try {
      const b = this.unb64(text);
      const mat = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b.slice(0, 16), iterations: 100000, hash: 'SHA-256' },
        mat, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(16, 28) }, key, b.slice(28));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch { return null; }
  }
};

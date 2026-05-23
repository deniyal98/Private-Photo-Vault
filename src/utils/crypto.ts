/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper: Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate a random string salt in Hex
export function generateRandomSalt(bytesCount = 16): string {
  const array = new Uint8Array(bytesCount);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate 12 bytes random IV in Base64
export function generateRandomIV(): Uint8Array {
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);
  return iv;
}

/**
 * Derives an AES-GCM 256 key from a plain text passphrase and a salt string.
 * Uses PBKDF2 with 100,000 iterations and SHA-256.
 */
export async function deriveKeyFromPassphrase(passphrase: string, saltHex: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);
  
  // Convert hex salt to Uint8Array
  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  // Import raw passphrase material
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    passphraseBytes,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive AES-GCM 256-bit key
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string using an AES-GCM cryptographic key.
 * Returns the Base64 IV and Base64 ciphertext.
 */
export async function encryptText(plaintext: string, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  const encoder = new TextEncoder();
  const ivBytes = generateRandomIV();
  const dataBytes = encoder.encode(plaintext);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBytes
    },
    key,
    dataBytes
  );

  return {
    iv: arrayBufferToBase64(ivBytes.buffer),
    ciphertext: arrayBufferToBase64(encryptedBuffer)
  };
}

/**
 * Decrypt a ciphertext Base64 string using IV Base64 and the AES-GCM key.
 * Returns the decrypted plaintext string.
 */
export async function decryptText(ciphertextBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  const ivBytes = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const ciphertextBytes = base64ToArrayBuffer(ciphertextBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes
    },
    key,
    ciphertextBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * High-level: Encrypt a structured photo object.
 * Returns the Base64 iv and ciphertext payload.
 */
export async function encryptPhotoData(
  photoMetaData: { title: string; description?: string; dataUrl: string; tags?: string[] },
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const serialized = JSON.stringify(photoMetaData);
  return encryptText(serialized, key);
}

/**
 * High-level: Decrypt a structured photo payload.
 * Returns the decrypted photo properties.
 */
export async function decryptPhotoData(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<{ title: string; description?: string; dataUrl: string; tags?: string[] }> {
  const parsedStr = await decryptText(ciphertextBase64, ivBase64, key);
  return JSON.parse(parsedStr);
}

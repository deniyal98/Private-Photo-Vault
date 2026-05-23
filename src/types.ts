/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  isEncrypted: boolean;
  salt?: string; // Salt for key derivation if encrypted (hex or base64)
  createdAt: string;
  ownerId: string;
}

export interface EncryptedPhoto {
  id: string;
  albumId: string;
  ownerId: string;
  isEncrypted: true;
  iv: string; // Base64
  salt: string; // Base64 salt used for this specific photo's key wrapping/derivation
  ciphertext: string; // Base64 of encrypted JSON
  uploadedAt: string;
}

export interface DecryptedPhoto {
  id: string;
  albumId: string;
  ownerId: string;
  isEncrypted: false;
  title: string;
  description?: string;
  dataUrl: string; // Resized Base64 JPEG data URL for fast loading and Firestore size safety
  tags?: string[];
  uploadedAt: string;
}

export type Photo = EncryptedPhoto | DecryptedPhoto;

export interface PhotoFilterSettings {
  brightness: number;  // 0% - 200% (default: 100)
  contrast: number;    // 0% - 200% (default: 100)
  saturation: number;  // 0% - 200% (default: 100)
  exposure: number;    // -100 to 100 (default: 0)
  sepia: number;       // 0% - 100% (default: 0)
  grayscale: number;   // 0% - 100% (default: 0)
  blur: number;        // 0px - 20px (default: 0)
  rotation: number;    // 0, 90, 180, 270 degrees
  hFlip: boolean;
  vFlip: boolean;
}

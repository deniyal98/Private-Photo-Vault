# Security Specification: Private Photo Vault

This document outlines the security architecture, data invariants, and adversarial test payloads designed to audit the Firestore Security Rules of the Private Photo Vault application containing client-side zero-knowledge encrypted albums.

## 1. Data Invariants

1. **Owner Isolation (Multi-Tenancy)**: No user can read, list, create, update, or delete albums or photos belonging to another user.
2. **Relational Integrity**: A photo cannot be uploaded unless its parent album exists, is owned by the uploading user, and matches the correct relationship.
3. **Property Integrity**:
   - For Encrypted Albums: A salt must be provided.
   - For Encrypted Photos: `iv`, `salt`, and `ciphertext` strings must be present and verified.
   - For Standard Photos: `title`, `description`, and `dataUrl` must be present.
4. **Id Hardening**: IDs must be strictly alphanumeric (plus dashes and underscores) and capped to prevent Denial of Wallet buffer overflow attacks.
5. **No Spoofing**: Users cannot set `ownerId` of another user on write.
6. **Immutable Fields**: `createdAt` and `ownerId` cannot be changed post-creation.

---

## 2. The "Dirty Dozen" Malicious Payloads

These 12 scenarios represent attempts by a malicious actor (or compromised client) to break security.

### 1. Album Identity Spoofing (Owner Forgery)
An authenticated user attempts to create an album with someone else’s `ownerId`.
```json
{
  "id": "malicious-album-1",
  "name": "Spoofed Owner Album",
  "isEncrypted": false,
  "createdAt": "2026-05-23T05:18:00Z",
  "ownerId": "victim_user_123"
}
```

### 2. Photo Orphanage (Non-Existent Album injection)
An attacker attempts to write a photo targeting a non-existent `albumId` to cause dangling resources.
```json
{
  "id": "orphan-photo-1",
  "albumId": "non-existent-album",
  "ownerId": "attacker_uid",
  "isEncrypted": false,
  "title": "Hack Proof",
  "dataUrl": "data:image/jpeg;base64,abc...",
  "uploadedAt": "2026-05-23T05:18:00Z"
}
```

### 3. Album Hijack (Photo injection in victim's album)
An attacker attempts to write a photo targeting a victim's private `albumId` (which they do not own).
```json
{
  "id": "hijack-photo-1",
  "albumId": "victim-private-album",
  "ownerId": "attacker_uid",
  "isEncrypted": false,
  "title": "Injected Photo",
  "dataUrl": "data:image/jpeg;base64,attack...",
  "uploadedAt": "2026-05-23T05:18:00Z"
}
```

### 4. PII Cross-Read (Victim Album Read)
Attacker tries to list/get another user's private encrypted album info.
`GET /albums/victim-album-id` with auth token of `attacker_uid`.

### 5. Ghost Field Shadow Injection (Privilege Escalation on User Profile)
Attacker attempts to write a field like `isAdmin` or `isPremium` on album creation.
```json
{
  "id": "album-ghost-1",
  "name": "My Album",
  "isEncrypted": false,
  "createdAt": "2026-05-23T05:18:00Z",
  "ownerId": "attacker_uid",
  "isAdmin": true
}
```

### 6. Buffer Denial of Wallet ID Poisoning
Attacker pushes a massive (e.g., 2MB) alphanumeric junk-character string as an ID to exhaust resources and drive up storage/index costs.
`PUT /albums/<2MB String ID>` with valid payload.

### 7. Mutable Creation Epoch
Attacker attempts to change the `createdAt` timestamp of an album on update.
`UPDATE /albums/existing-album-id` changing `createdAt` from original to a future date.

### 8. Salt Stripping on Encrypted Album
Attacker writes an encrypted album `isEncrypted: true` but strips the `salt` field or passes it as an empty object.
```json
{
  "id": "stripped-vault-1",
  "name": "My Vault",
  "isEncrypted": true,
  "createdAt": "2026-05-23T05:18:00Z",
  "ownerId": "attacker_uid"
}
```

### 9. Ciphertext Bypass on Encrypted Photo
Attacker uploads a photo with `isEncrypted: true` but doesn't supply `ciphertext` or supply it with incorrect type (e.g. integer).
```json
{
  "id": "broken-crypto-1",
  "albumId": "my-album-id",
  "ownerId": "attacker_uid",
  "isEncrypted": true,
  "iv": "base64-iv",
  "salt": "base64-salt",
  "ciphertext": 12345,
  "uploadedAt": "2026-05-23T05:18:00Z"
}
```

### 10. Photo Title Oversizing (Size Poisoning)
Attacker uploads a standard photo with an unencrypted title containing a 10MB string to exhaust user data sizes.
`title: <10MB text...>`

### 11. Unauthorized Cross-Delete
Attacker tries to delete a photo owned by another user.
`DELETE /photos/victim-photo-id` by authenticated `attacker_uid`.

### 12. Unverified Email Access
Attacker registers with spoofed admin email but `email_verified == false` seeking to read global assets.
`GET /albums/any-album-id` by auth `email_verified == false`.

---

## 3. Test Cases (TDD Rules Outline)

All 12 adversarial test payloads must return `PERMISSION_DENIED` at the Firebase engine.
Our `firestore.rules` will enforce these assertions cleanly.

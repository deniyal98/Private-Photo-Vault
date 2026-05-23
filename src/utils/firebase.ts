/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Check if firebase configuration has been fully provisioned by checking the apiKey
export const isFirebaseConfigured = !!(firebaseConfig && firebaseConfig.apiKey);

let firebaseApp;
let firestoreDb: any = null;
let firebaseAuth: any = null;

if (isFirebaseConfigured) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");
    firebaseAuth = getAuth(firebaseApp);
  } catch (error) {
    console.error("Failed to initialize Firebase SDK:", error);
  }
}

export const db = firestoreDb;
export const auth = firebaseAuth;
export const googleProvider = isFirebaseConfigured ? new GoogleAuthProvider() : null;

/**
 * Handle firestore error with detailed JSON payload wrapping for the AI Studio Build engine.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to firestore on boot as mandated in SKILL.md.
 */
export async function validateFirestoreConnection() {
  if (!isFirebaseConfigured || !db) return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Please check your Firebase configuration or internet connection. Device is offline.");
    }
  }
}

// Call on startup
validateFirestoreConnection().catch(console.error);

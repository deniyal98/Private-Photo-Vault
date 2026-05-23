/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  getDocs
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { 
  db, 
  auth, 
  googleProvider, 
  isFirebaseConfigured, 
  handleFirestoreError, 
  OperationType 
} from "../utils/firebase";
import { Album, Photo, AuthUser } from "../types";
import { generateRandomSalt, deriveKeyFromPassphrase, encryptPhotoData } from "../utils/crypto";

export function usePhotoVault() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"local" | "connecting" | "synced" | "error">("local");

  // Track Auth state
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      setSyncStatus("local");
      return;
    }

    setSyncStatus("connecting");
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified
        });
        setSyncStatus("synced");
      } else {
        setUser(null);
        setSyncStatus("local");
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch albums & photos (Realtime Sync when user logged in, otherwise LocalStorage)
  useEffect(() => {
    if (!user) {
      // Offline mode: Load from LocalStorage
      const localAlbums = localStorage.getItem("photo_vault_albums");
      const localPhotos = localStorage.getItem("photo_vault_photos");
      setAlbums(localAlbums ? JSON.parse(localAlbums) : []);
      setPhotos(localPhotos ? JSON.parse(localPhotos) : []);
      setLoading(false);
      return;
    }

    setLoading(true);
    const albumsPath = "albums";
    const photosPath = "photos";

    // Compliant queries restricting resource scanning directly on ownerId
    const albumsQuery = query(collection(db, albumsPath), where("ownerId", "==", user.uid));
    const photosQuery = query(collection(db, photosPath), where("ownerId", "==", user.uid));

    const unsubAlbums = onSnapshot(
      albumsQuery,
      (snapshot) => {
        const fetchedAlbums: Album[] = [];
        snapshot.forEach((docSnap) => {
          fetchedAlbums.push(docSnap.data() as Album);
        });
        setAlbums(fetchedAlbums.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, albumsPath);
        setSyncStatus("error");
      }
    );

    const unsubPhotos = onSnapshot(
      photosQuery,
      (snapshot) => {
        const fetchedPhotos: Photo[] = [];
        snapshot.forEach((docSnap) => {
          fetchedPhotos.push(docSnap.data() as Photo);
        });
        setPhotos(fetchedPhotos.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, photosPath);
        setSyncStatus("error");
      }
    );

    return () => {
      unsubAlbums();
      unsubPhotos();
    };
  }, [user]);

  // Handle Authentication trigger
  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      alert("Firebase integration has not been provisioned yet. Please accept Terms in the Firebase UI panel.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Helper helper: Saves local state
  const saveLocalState = (updatedAlbums: Album[], updatedPhotos: Photo[]) => {
    if (!user) {
      localStorage.setItem("photo_vault_albums", JSON.stringify(updatedAlbums));
      localStorage.setItem("photo_vault_photos", JSON.stringify(updatedPhotos));
    }
  };

  // Album Operations
  const createAlbum = async (name: string, description: string, isEncrypted: boolean, password?: string) => {
    const albumId = "album_" + Math.random().toString(36).substring(2, 11);
    const ownerId = user ? user.uid : "local_user";
    
    let salt: string | undefined = undefined;
    if (isEncrypted) {
      salt = generateRandomSalt(16); // Hex string salt
    }

    const newAlbum: Album = {
      id: albumId,
      name,
      description: description || undefined,
      isEncrypted,
      salt,
      createdAt: new Date().toISOString(),
      ownerId
    };

    const nextAlbums = [newAlbum, ...albums];
    setAlbums(nextAlbums);
    saveLocalState(nextAlbums, photos);

    if (user && db) {
      const path = `albums/${albumId}`;
      try {
        await setDoc(doc(db, "albums", albumId), newAlbum);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const deleteAlbum = async (albumId: string) => {
    const nextAlbums = albums.filter(a => a.id !== albumId);
    const nextPhotos = photos.filter(p => p.albumId !== albumId);
    
    setAlbums(nextAlbums);
    setPhotos(nextPhotos);
    saveLocalState(nextAlbums, nextPhotos);

    if (user && db) {
      try {
        // Delete parent album doc directly from database
        await deleteDoc(doc(db, "albums", albumId));

        // Delete all associated photo documents directly from database in parallel
        const photosPath = "photos";
        const q = query(collection(db, photosPath), where("albumId", "==", albumId), where("ownerId", "==", user.uid));
        const snapshots = await getDocs(q);
        
        const deletePromises = snapshots.docs.map((photoDoc) => 
          deleteDoc(doc(db, "photos", photoDoc.id))
        );
        
        await Promise.all(deletePromises);
        console.log(`Directly deleted album ${albumId} and ${deletePromises.length} associated photos from the database.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `albums/${albumId}`);
      }
    }
  };

  // Photo Operations
  const addPhoto = async (photoData: {
    albumId: string;
    title: string;
    description?: string;
    dataUrl: string;
    tags?: string[];
    isEncrypted: boolean;
    encryptionKey?: CryptoKey; // Prereffered already derived from master pwd
    salt?: string;
  }) => {
    const photoId = "photo_" + Math.random().toString(36).substring(2, 11);
    const ownerId = user ? user.uid : "local_user";
    const uploadedAt = new Date().toISOString();

    let newPhoto: Photo;

    if (photoData.isEncrypted) {
      if (!photoData.encryptionKey) {
        throw new Error("album is encrypted but no active encryption key is loaded");
      }
      
      const payloadFile = {
        title: photoData.title,
        description: photoData.description,
        dataUrl: photoData.dataUrl,
        tags: photoData.tags || []
      };

      // In-browser AES GCM Encryption
      const encrypted = await encryptPhotoData(payloadFile, photoData.encryptionKey);
      
      newPhoto = {
        id: photoId,
        albumId: photoData.albumId,
        ownerId,
        isEncrypted: true,
        iv: encrypted.iv,
        salt: photoData.salt || "",
        ciphertext: encrypted.ciphertext,
        uploadedAt
      };
    } else {
      newPhoto = {
        id: photoId,
        albumId: photoData.albumId,
        ownerId,
        isEncrypted: false,
        title: photoData.title,
        description: photoData.description || undefined,
        dataUrl: photoData.dataUrl,
        tags: photoData.tags || [],
        uploadedAt
      };
    }

    const nextPhotos = [newPhoto, ...photos];
    setPhotos(nextPhotos);
    saveLocalState(albums, nextPhotos);

    if (user && db) {
      const path = `photos/${photoId}`;
      try {
        await setDoc(doc(db, "photos", photoId), newPhoto);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const deletePhoto = async (photoId: string) => {
    const nextPhotos = photos.filter(p => p.id !== photoId);
    setPhotos(nextPhotos);
    saveLocalState(albums, nextPhotos);

    if (user && db) {
      const path = `photos/${photoId}`;
      try {
        await deleteDoc(doc(db, "photos", photoId));
        console.log(`Directly deleted photo ${photoId} from the database.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const updatePhoto = async (photoId: string, updatedFields: Partial<Photo>) => {
    const nextPhotos = photos.map(p => {
      if (p.id === photoId) {
        return { ...p, ...updatedFields } as Photo;
      }
      return p;
    });

    setPhotos(nextPhotos);
    saveLocalState(albums, nextPhotos);

    if (user && db) {
      const path = `photos/${photoId}`;
      try {
        await setDoc(doc(db, "photos", photoId), updatedFields, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  };

  // Automated migration: If user joins cloud sync, upload pending local records
  const migrateLocalToCloud = async (uid: string) => {
    const localAlbumsRaw = localStorage.getItem("photo_vault_albums");
    const localPhotosRaw = localStorage.getItem("photo_vault_photos");
    if (!localAlbumsRaw && !localPhotosRaw) return;

    try {
      const localAlbums: Album[] = localAlbumsRaw ? JSON.parse(localAlbumsRaw) : [];
      const localPhotos: Photo[] = localPhotosRaw ? JSON.parse(localPhotosRaw) : [];

      if (localAlbums.length === 0) return;

      // Upload with updated owners
      for (const alb of localAlbums) {
        const updatedAlb = { ...alb, ownerId: uid };
        await setDoc(doc(db, "albums", alb.id), updatedAlb);
      }

      for (const ph of localPhotos) {
        const updatedPh = { ...ph, ownerId: uid };
        await setDoc(doc(db, "photos", ph.id), updatedPh);
      }

      // Purge local migration logs to avoid duplicates
      localStorage.removeItem("photo_vault_albums");
      localStorage.removeItem("photo_vault_photos");
    } catch (e) {
      console.error("State migration to firestore sync failed:", e);
    }
  };

  useEffect(() => {
    if (user && db) {
      migrateLocalToCloud(user.uid);
    }
  }, [user]);

  return {
    user,
    albums,
    photos,
    loading,
    syncStatus,
    isFirebaseConfigured,
    loginWithGoogle,
    logout,
    createAlbum,
    deleteAlbum,
    addPhoto,
    deletePhoto,
    updatePhoto
  };
}

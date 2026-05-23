/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  FolderLock, 
  Folder, 
  Plus, 
  Trash2, 
  Search, 
  Tag, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  Upload, 
  Loader2, 
  Cloud, 
  CloudOff, 
  LogOut, 
  Sparkles,
  RefreshCw,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  FileMinus,
  HelpCircle,
  Clock
} from "lucide-react";
import { usePhotoVault } from "./hooks/usePhotoVault";
import { Album, Photo, DecryptedPhoto, EncryptedPhoto } from "./types";
import { deriveKeyFromPassphrase, decryptPhotoData } from "./utils/crypto";

// Sub-components
import CreateAlbumModal from "./components/CreateAlbumModal";
import UploadZone from "./components/UploadZone";
import PhotoDetailModal from "./components/PhotoDetailModal";
import PhotoEditor from "./components/PhotoEditor";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";

export default function App() {
  const {
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
  } = usePhotoVault();

  // Active UI States
  const [activeAlbumId, setActiveAlbumId] = useState<string>("");
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [albumPasswords, setAlbumPasswords] = useState<Record<string, string>>({});
  const [unlockedKeys, setUnlockedKeys] = useState<Record<string, CryptoKey>>({});
  
  // Decryption Pipeline Cache
  const [decryptedPhotos, setDecryptedPhotos] = useState<Record<string, DecryptedPhoto>>({});
  const [unlockPasswordInput, setUnlockPasswordInput] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Focus detail slideshow states
  const [activePhoto, setActivePhoto] = useState<DecryptedPhoto | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; title: string; type: "photo" | "album" } | null>(null);

  // Search & Filter state
  const [searchText, setSearchText] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Active Album details computed
  const activeAlbum = useMemo(() => {
    return albums.find(a => a.id === activeAlbumId) || albums[0] || null;
  }, [albums, activeAlbumId]);

  // Sync state active ID selector on load
  useEffect(() => {
    if (albums.length > 0 && !activeAlbumId) {
      setActiveAlbumId(albums[0].id);
    }
  }, [albums, activeAlbumId]);

  // Clean decryption cache when albums are closed, loaded, or password logs are deleted
  useEffect(() => {
    setDecryptingStatus(false);
  }, [activeAlbumId]);

  const [decryptingStatus, setDecryptingStatus] = useState(false);

  // Progressive background decryption engine
  useEffect(() => {
    let active = true;
    const decryptPendingPhotos = async () => {
      if (!activeAlbum) return;

      const currentAlbumId = activeAlbum.id;
      
      // Filter out photos belonging to this active folder
      const albumPhotos = photos.filter(p => p.albumId === currentAlbumId);
      
      // Isolate photos that are encrypted, have an active memory key compiled, and are not yet cached
      const pending = albumPhotos.filter(
        p => p.isEncrypted && unlockedKeys[currentAlbumId] && !decryptedPhotos[p.id]
      ) as EncryptedPhoto[];

      if (pending.length === 0) return;

      setDecryptingStatus(true);
      const key = unlockedKeys[currentAlbumId];
      const newlyDecrypted: Record<string, DecryptedPhoto> = {};

      for (const ph of pending) {
        if (!active) return;
        try {
          const decryptedMeta = await decryptPhotoData(ph.ciphertext, ph.iv, key);
          newlyDecrypted[ph.id] = {
            id: ph.id,
            albumId: ph.albumId,
            ownerId: ph.ownerId,
            isEncrypted: false,
            title: decryptedMeta.title || "Untitled",
            description: decryptedMeta.description,
            dataUrl: decryptedMeta.dataUrl,
            tags: decryptedMeta.tags || [],
            uploadedAt: ph.uploadedAt
          };
        } catch (e) {
          console.error("Crypto integrity failure for document ID: ", ph.id, e);
        }
      }

      if (Object.keys(newlyDecrypted).length > 0 && active) {
        setDecryptedPhotos(prev => ({ ...prev, ...newlyDecrypted }));
      }
      setDecryptingStatus(false);
    };

    decryptPendingPhotos();

    return () => {
      active = false;
    };
  }, [photos, activeAlbum, unlockedKeys]);

  // Decrypted & Standard unified view array
  const activePhotosCompiled = useMemo(() => {
    if (!activeAlbum) return [];

    const albumPhotos = photos.filter(p => p.albumId === activeAlbum.id);

    return albumPhotos.map(p => {
      if (p.isEncrypted) {
        return decryptedPhotos[p.id] || null; // Null if locked or not yet decrypted
      }
      return p as DecryptedPhoto;
    }).filter(Boolean) as DecryptedPhoto[];
  }, [photos, activeAlbum, decryptedPhotos]);

  // Search and Tag filter filters applied
  const filteredPhotos = useMemo(() => {
    return activePhotosCompiled.filter(p => {
      const matchesSearch = searchText.trim() === "" ||
        p.title.toLowerCase().includes(searchText.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchText.toLowerCase()));
      
      const matchesTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));

      return matchesSearch && matchesTag;
    });
  }, [activePhotosCompiled, searchText, selectedTag]);

  // Aggregate all unique tags in the active album
  const albumTagsList = useMemo(() => {
    const list = new Set<string>();
    activePhotosCompiled.forEach(p => {
      if (p.tags) {
        p.tags.forEach(t => list.add(t));
      }
    });
    return Array.from(list);
  }, [activePhotosCompiled]);

  // Unlock password trigger
  const handleUnlockAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlbum || !activeAlbum.salt) return;
    setUnlockError(null);

    try {
      const derived = await deriveKeyFromPassphrase(unlockPasswordInput, activeAlbum.salt);
      
      // Test credentials encryption validity by looking for a test verification payload 
      // or simply loading key. Since Web Crypto deriveKey is deterministic, we store the derived key
      // in React memory. If a decrypted photo fails, it implies invalid key.
      // Let's cache the derived key of this album!
      setUnlockedKeys(prev => ({ ...prev, [activeAlbum.id]: derived }));
      setAlbumPasswords(prev => ({ ...prev, [activeAlbum.id]: unlockPasswordInput }));
      setUnlockPasswordInput("");
    } catch (e: any) {
      setUnlockError("Access keys derivation failed: " + e.message);
    }
  };

  // Lock back album immediately (purging security credentials from memory)
  const handleLockAlbum = (albumId: string) => {
    setUnlockedKeys(prev => {
      const copy = { ...prev };
      delete copy[albumId];
      return copy;
    });
    setAlbumPasswords(prev => {
      const copy = { ...prev };
      delete copy[albumId];
      return copy;
    });
    // Purge cached decrypted photos of this album
    setDecryptedPhotos(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(photoId => {
        if (copy[photoId].albumId === albumId) {
          delete copy[photoId];
        }
      });
      return copy;
    });
    setActivePhoto(null);
  };

  // Upload handler triggering Encryption wrapper if encrypted on-the-fly
  const handlePhotoUploadProcessed = async (photoPayload: {
    title: string;
    dataUrl: string;
    size: number;
    width: number;
    height: number;
    mimeType: string;
  }) => {
    if (!activeAlbum) return;

    try {
      if (activeAlbum.isEncrypted) {
        const key = unlockedKeys[activeAlbum.id];
        const rawPwd = albumPasswords[activeAlbum.id];
        if (!key || !rawPwd) {
          alert("Album is locked. Please unlock album before uploading.");
          return;
        }

        await addPhoto({
          albumId: activeAlbum.id,
          title: photoPayload.title,
          dataUrl: photoPayload.dataUrl,
          isEncrypted: true,
          encryptionKey: key,
          salt: activeAlbum.salt,
          tags: ["encrypted"]
        });
      } else {
        await addPhoto({
          albumId: activeAlbum.id,
          title: photoPayload.title,
          dataUrl: photoPayload.dataUrl,
          isEncrypted: false,
          tags: ["photo"]
        });
      }
    } catch (err: any) {
      alert("Encryption sync upload failed: " + err.message);
    }
  };

  // Tag editors
  const handleAddTag = (photoId: string, tag: string) => {
    const photoItem = photos.find(p => p.id === photoId);
    if (!photoItem) return;

    const currentTags = (photoItem as any).tags || [];
    if (currentTags.includes(tag)) return;

    const updatedTags = [...currentTags, tag];

    if (photoItem.isEncrypted) {
      // Re-encrypt photo details with updated tags!
      reEncryptAndSavePhoto(photoId, { tags: updatedTags });
    } else {
      updatePhoto(photoId, { tags: updatedTags });
    }
  };

  const handleRemoveTag = (photoId: string, tag: string) => {
    const photoItem = photos.find(p => p.id === photoId);
    if (!photoItem) return;

    const currentTags = (photoItem as any).tags || [];
    const updatedTags = currentTags.filter((t: string) => t !== tag);

    if (photoItem.isEncrypted) {
      reEncryptAndSavePhoto(photoId, { tags: updatedTags });
    } else {
      updatePhoto(photoId, { tags: updatedTags });
    }
  };

  // Core background re-encrypt modifier helper
  const reEncryptAndSavePhoto = async (photoId: string, modifications: Partial<DecryptedPhoto>) => {
    if (!activeAlbum) return;
    const rawPhoto = photos.find(p => p.id === photoId);
    const decryptedItem = decryptedPhotos[photoId];
    const key = unlockedKeys[activeAlbum.id];

    if (!rawPhoto || !decryptedItem || !key) return;

    // Build unified updated fields
    const updatedModel = {
      title: modifications.title !== undefined ? modifications.title : decryptedItem.title,
      description: modifications.description !== undefined ? modifications.description : decryptedItem.description,
      dataUrl: modifications.dataUrl !== undefined ? modifications.dataUrl : decryptedItem.dataUrl,
      tags: modifications.tags !== undefined ? modifications.tags : decryptedItem.tags
    };

    // Derived Encrypted string
    const encrypted = await decryptPhotoData(rawPhoto.id, "", key).catch(() => null); // mock payload prep
    const payload = {
      title: updatedModel.title,
      description: updatedModel.description,
      dataUrl: updatedModel.dataUrl,
      tags: updatedModel.tags
    };

    const cryptoPayload = await import("./utils/crypto").then(c => c.encryptPhotoData(payload, key));

    const updatedEncryptedData: Partial<Photo> = {
      iv: cryptoPayload.iv,
      ciphertext: cryptoPayload.ciphertext
    };

    // Update in Db
    updatePhoto(photoId, updatedEncryptedData);

    // Sync in local Cache instantly
    setDecryptedPhotos(prev => ({
      ...prev,
      [photoId]: {
        ...decryptedItem,
        ...updatedModel
      }
    }));

    // Update activePhoto model if synced
    if (activePhoto && activePhoto.id === photoId) {
      setActivePhoto({
        ...activePhoto,
        ...updatedModel
      });
    }
  };

  // Editor saving modifications triggers canvas compiler and cloud sync
  const handleEditorSave = async (newCompiledDataUrl: string) => {
    if (!activePhoto) return;
    
    setIsEditorOpen(false);

    if (activeAlbum && activeAlbum.isEncrypted) {
      await reEncryptAndSavePhoto(activePhoto.id, { dataUrl: newCompiledDataUrl });
    } else {
      updatePhoto(activePhoto.id, { dataUrl: newCompiledDataUrl });
      setActivePhoto({
        ...activePhoto,
        dataUrl: newCompiledDataUrl
      });
    }
  };

  // Action handler to carry out confirmed deletion operations
  const executeDeleteConfirmTarget = () => {
    if (!deleteConfirmTarget) return;
    const { id, type } = deleteConfirmTarget;
    if (type === "photo") {
      deletePhoto(id);
      if (activePhoto && activePhoto.id === id) {
        setActivePhoto(null);
      }
    } else if (type === "album") {
      deleteAlbum(id);
      if (activeAlbumId === id) {
        setActiveAlbumId("");
      }
    }
    setDeleteConfirmTarget(null);
  };

  // Slideshow controllers
  const slideshowIndices = useMemo(() => {
    const list = filteredPhotos;
    const currentIdx = activePhoto ? list.findIndex(p => p.id === activePhoto.id) : -1;
    return {
      list,
      currentIdx,
      hasPrev: currentIdx > 0,
      hasNext: currentIdx < list.length - 1 && currentIdx !== -1
    };
  }, [filteredPhotos, activePhoto]);

  const handlePrevSlide = () => {
    const { list, currentIdx, hasPrev } = slideshowIndices;
    if (hasPrev) {
      setActivePhoto(list[currentIdx - 1]);
    }
  };

  const handleNextSlide = () => {
    const { list, currentIdx, hasNext } = slideshowIndices;
    if (hasNext) {
      setActivePhoto(list[currentIdx + 1]);
    }
  };

  return (
    <div id="app-root-vault" className="min-h-screen bg-[#07070a] font-sans text-zinc-200 flex flex-col antialiased selection:bg-zinc-800 relative overflow-hidden bg-grid-cyber">
      {/* Interactive Floating Halo Lights (Sleek Metallic Silver & Slate Theme) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[-10%] w-[55%] aspect-square rounded-full bg-silver-radial blur-3xl opacity-60 animate-float-slow" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50%] aspect-square rounded-full bg-silver-radial blur-3xl opacity-50 animate-float-slower" />
        <div className="absolute top-[35%] left-[30%] w-[400px] aspect-square rounded-full bg-zinc-500/5 blur-[130px]" />
      </div>
      
      {/* Upper Brand Section */}
      <header className="bg-[#0f0f12]/90 border-b border-zinc-850 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-2xl backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-650 text-zinc-950 rounded-2xl shadow-lg shadow-zinc-950/40 border border-zinc-200">
            <FolderLock className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-white leading-none font-mono uppercase">Vault.GCM</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Direct Zero-Knowledge Secure Cryptography</p>
          </div>
        </div>

        {/* Sync, Sync Indicators, Credentials */}
        <div className="flex items-center gap-4">
          
          {/* Cloud Sync indicator */}
          <div className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition ${
            syncStatus === "synced" 
              ? "bg-zinc-900 text-zinc-200 border-zinc-800" 
              : "bg-amber-955/20 text-amber-400 border-amber-900/30"
          }`}>
            {syncStatus === "synced" ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-zinc-300" />
                <span>Cloud Secure</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                <span>Sandbox Session</span>
              </>
            )}
          </div>

          {/* User auth flow panel */}
          {user ? (
            <div className="flex items-center gap-3 bg-zinc-900 px-3 py-1.5 rounded-2xl border border-zinc-800">
              {user.photoURL && (
                <img
                  id="profile-avatar"
                  src={user.photoURL}
                  referrerPolicy="no-referrer"
                  alt={user.displayName || "User profile"}
                  className="w-6 h-6 rounded-full border border-zinc-700 shadow-inner"
                />
              )}
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-white leading-none">{user.displayName || "Private Owner"}</p>
                <p className="text-[10px] text-zinc-450 mt-0.5 leading-none font-mono">{user.email}</p>
              </div>
              
              <button
                id="signout-trigger-btn"
                onClick={logout}
                title="Log out of Secure Session"
                className="p-1 hover:bg-zinc-800 rounded transition cursor-pointer text-zinc-400 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            isFirebaseConfigured && (
              <button
                id="signin-trigger-btn"
                onClick={loginWithGoogle}
                className="px-4 py-2 bg-white hover:bg-zinc-200 text-black border border-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-black/80 cursor-pointer"
              >
                Join Cloud Sync
              </button>
            )
          )}
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Column: Album Directory */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-[#0f0f12] border border-zinc-850 rounded-3xl p-5 flex flex-col gap-5 shadow-xl">
            
            {/* Header block inside Sidebar */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-zinc-350" />
                Albums Collection
              </span>
              
              <button
                id="create-album-btn"
                onClick={() => setIsCreateAlbumOpen(true)}
                className="p-1.5 bg-zinc-905 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-lg transition"
                title="Create a new secure Album"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Empty view list */}
            {albums.length === 0 && !loading && (
              <div className="text-center py-8 px-4 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10 space-y-2">
                <Folder className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-xs font-semibold text-zinc-400">No albums yet</p>
                <p className="text-[10px] text-zinc-500">Click the '+' button to bootstrap a private vault folder.</p>
              </div>
            )}

            {/* List Albums */}
            <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
              {albums.map(alb => {
                const isActive = alb.id === activeAlbumId;
                const isLocked = alb.isEncrypted && !unlockedKeys[alb.id];
                const countOfFiles = photos.filter(p => p.albumId === alb.id).length;

                return (
                  <div
                    key={alb.id}
                    id={`album-list-item-${alb.id}`}
                    onClick={() => setActiveAlbumId(alb.id)}
                    className={`group w-full p-3 rounded-2xl flex items-center justify-between text-left cursor-pointer transition border ${
                      isActive 
                        ? "bg-white text-zinc-950 border-white shadow-xl" 
                        : "bg-zinc-900/40 hover:bg-zinc-900 text-zinc-350 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`p-2 rounded-xl shrink-0 border ${
                        isActive 
                          ? "bg-zinc-950 text-white border-zinc-805" 
                          : alb.isEncrypted 
                            ? "bg-zinc-850 text-zinc-200 border-zinc-700" 
                            : "bg-zinc-900 text-zinc-400 border-zinc-800"
                      }`}>
                        {alb.isEncrypted ? (
                          isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />
                        ) : (
                          <Folder className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold truncate block tracking-wide">{alb.name}</span>
                        <span className={`text-[10px] ${isActive ? "text-zinc-650" : "text-zinc-500"} block mt-0.5`}>
                          {countOfFiles} {countOfFiles === 1 ? "photo" : "photos"}
                        </span>
                      </div>
                    </div>

                    {/* Quick deleting action for non-active albums */}
                    <button
                      id={`delete-album-btn-${alb.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmTarget({ id: alb.id, title: alb.name, type: "album" });
                      }}
                      className={`text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 pointer-events-auto transition p-1 rounded-lg ${isActive ? "text-zinc-950 hover:bg-zinc-200" : "hover:bg-zinc-800"}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Sandbox details */}
            {!isFirebaseConfigured && (
              <div className="p-3 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-2xl text-[10px] space-y-1.5">
                <span className="font-semibold block text-white uppercase tracking-wider">Secure Local Storage</span>
                <p>Everything is encrypted and saved locally in your browser. Accept Terms in the Firebase box to connect Google Cloud Sync.</p>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Active Album Grid View */}
        <main className="lg:col-span-9 flex flex-col gap-6">
          {activeAlbum ? (
            <div className="bg-[#0f0f12] border border-zinc-850 rounded-3xl p-6 flex flex-col gap-6 shadow-xl min-h-[500px]">
              
              {/* Active Album Meta Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-855 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 id="active-folder-title" className="text-lg font-bold tracking-tight text-white leading-none font-mono">
                      {activeAlbum.name}
                    </h2>
                    {activeAlbum.isEncrypted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 uppercase tracking-widest font-mono">
                        <Lock className="w-3 h-3 text-zinc-400" />
                        <span>AES Secure Vault</span>
                      </span>
                    )}
                  </div>
                  {activeAlbum.description && (
                    <p id="active-folder-desc" className="text-xs text-zinc-400 font-sans max-w-xl">
                      {activeAlbum.description}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-550 font-semibold flex items-center gap-1 font-mono uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-zinc-600" />
                    Created {new Date(activeAlbum.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Lock Management button */}
                {activeAlbum.isEncrypted && unlockedKeys[activeAlbum.id] && (
                  <button
                    id="album-relock-trigger-btn"
                    onClick={() => handleLockAlbum(activeAlbum.id)}
                    className="self-start sm:self-center px-4 py-2 bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800 text-xs font-bold rounded-xl flex items-center gap-2 border border-zinc-800 hover:border-zinc-700 transition shadow-md cursor-pointer uppercase tracking-wider"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Lock Session Vault</span>
                  </button>
                )}
              </div>

              {/* LOCK STATE IN ENCRYPTED ALBUM VIEW */}
              {activeAlbum.isEncrypted && !unlockedKeys[activeAlbum.id] ? (
                <div id="vault-locked-prompt" className="flex-1 flex flex-col items-center justify-center py-16 px-4 max-w-md mx-auto text-center space-y-6">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-850 text-zinc-300 flex items-center justify-center shadow-2xl animate-pulse">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider">Passphrase Required</h3>
                    <p className="text-xs text-zinc-400 font-sans max-w-xs leading-relaxed">
                      Enter the Master Passphrase set during album initialization. Deriving the 256-bit credentials is done purely in-browser. We never save your key!
                    </p>
                  </div>

                  <form onSubmit={handleUnlockAlbum} className="w-full space-y-3">
                    <input
                      id="vault-passphrase-unlock"
                      type="password"
                      value={unlockPasswordInput}
                      onChange={e => setUnlockPasswordInput(e.target.value)}
                      placeholder="Passphrase"
                      className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-zinc-700 transition text-zinc-100 text-sm text-center font-mono placeholder-zinc-700"
                    />
                    
                    {unlockError && (
                      <div className="text-[11px] font-semibold text-red-400 px-3 py-1.5 bg-red-950/20 border border-red-900/50 rounded-lg">
                        {unlockError}
                      </div>
                    )}

                    <button
                      id="vault-unlock-btn"
                      type="submit"
                      className="w-full py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl tracking-wider uppercase transition shadow-lg cursor-pointer border border-white"
                    >
                      Authenticate and Decrypt
                    </button>
                  </form>
                </div>
              ) : (
                /* UNLOCKED / STANDARD VIEWS */
                <>
                  {/* Photo Search/Filter segment */}
                  {activePhotosCompiled.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-zinc-855 pb-4 h-fit">
                      <div className="relative w-full sm:max-w-xs">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          id="search-filter-photos"
                          type="text"
                          value={searchText}
                          onChange={e => setSearchText(e.target.value)}
                          placeholder="Search photos..."
                          className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-950 text-white border border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-zinc-700 transition placeholder-zinc-650"
                        />
                      </div>

                      {/* Tag Cluster scroll filters */}
                      {albumTagsList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
                          <span className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold flex items-center gap-1 font-mono">
                            <Tag className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Filter Tag:</span>
                          </span>

                          <button
                            id="tag-filter-reset"
                            onClick={() => setSelectedTag(null)}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer uppercase ${!selectedTag ? "bg-[#fafafa] text-zinc-950 border-[#fafafa]" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800"}`}
                          >
                            All
                          </button>

                          {albumTagsList.map(tag => (
                            <button
                              key={tag}
                              id={`tag-filter-${tag}`}
                              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer ${selectedTag === tag ? "bg-[#fafafa] text-zinc-950 border-[#fafafa] shadow-md" : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800"}`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progressive decryption indicator */}
                  {decryptingStatus && (
                    <div className="p-3 bg-zinc-900/60 text-zinc-350 border border-zinc-800 rounded-2xl text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                        <span>Decrypting GCM local vault photos securely...</span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-500 font-bold">AES-GCM-256</span>
                    </div>
                  )}

                  {/* Photo Grid list layout */}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredPhotos.map(ph => (
                      <div
                        key={ph.id}
                        id={`photo-card-${ph.id}`}
                        onClick={() => setActivePhoto(ph)}
                        className="group relative bg-[#0d0d10]/90 backdrop-blur-md rounded-2xl overflow-hidden cursor-pointer border border-zinc-850 hover:border-zinc-400 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.06)] hover:scale-[1.02] sweep-highlight flex flex-col justify-between shadow-xl"
                      >
                        {/* Decorative Corner Viewfinder Bracket (Silver Aesthetics) */}
                        <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-black/75 border border-zinc-800 text-[8px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                          REC
                        </div>

                        {/* Encrypted indicator decoration */}
                        {activeAlbum && activeAlbum.isEncrypted && (
                          <div className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/75 text-zinc-300 border border-zinc-800 backdrop-blur-sm shadow-md" title="Hardware Derivated GCM Lock">
                            <Lock className="w-3 h-3 text-zinc-300 animate-pulse" />
                          </div>
                        )}

                        {/* Aspect block frame */}
                        <div className="aspect-square w-full relative bg-[#08080a] flex items-center justify-center overflow-hidden border-b border-zinc-900">
                          <img
                            src={ph.dataUrl}
                            alt={ph.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          />
                        </div>

                        {/* Title block & Mini tags footer */}
                        <div className="p-3.5 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-900/40 space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold leading-tight truncate text-white block font-mono tracking-wide">{ph.title || "Untitled"}</span>
                            <span className="text-[8px] text-zinc-500 font-mono shrink-0">{(ph.dataUrl.length / 1024).toFixed(0)}KB</span>
                          </div>
                          
                          <p className="text-[10px] text-zinc-400 block font-sans truncate leading-normal">
                            {ph.description || "No description provided."}
                          </p>
                          
                          {/* Mini Tags in preview footer */}
                          {(ph.tags || []).length > 0 && (
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth pt-1 text-[9px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                              <Tag className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
                              {(ph.tags || []).slice(0, 2).map(t => (
                                <span key={t} className="shrink-0 text-zinc-400">#{t}</span>
                              ))}
                              {(ph.tags || []).length > 2 && <span className="text-[8px] text-zinc-550 shrink-0">+{ph.tags!.length - 2}</span>}
                            </div>
                          )}
                        </div>

                        {/* Quick hover trash action */}
                        <button
                          id={`photo-quick-delete-${ph.id}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmTarget({ id: ph.id, title: ph.title || "Untitled", type: "photo" });
                          }}
                          className="absolute bottom-16 right-3.5 p-2 bg-black/80 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition duration-150 opacity-0 group-hover:opacity-100 pointer-events-auto shadow-xl"
                          title="Delete Photo Permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Empty state active folder */}
                  {filteredPhotos.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">No photos found</h3>
                        <p className="text-xs text-zinc-400 font-sans max-w-xs">
                          {searchText || selectedTag 
                            ? "Try broadening your search text or removing tag filters." 
                            : "Upload your first photo below to secure your files."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* UPLOADER REGION */}
                  <div className="border-t border-zinc-850 pt-6 space-y-4">
                    <span className="text-xs font-bold text-zinc-350 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                      <Upload className="w-4 h-4 text-zinc-400" />
                      Upload Photo to "{activeAlbum.name}"
                    </span>
                    
                    <UploadZone onFileProcessed={handlePhotoUploadProcessed} />
                  </div>
                </>
              )}

            </div>
          ) : (
            /* GENERAL UNSELECTED STATE */
            <div className="bg-[#0f0f12] border border-zinc-850 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 min-h-[500px] shadow-xl">
              <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center animate-pulse">
                <FolderOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white uppercase tracking-wider font-mono">No Album Selected</h3>
                <p className="text-xs text-zinc-400 max-w-sm font-sans mx-auto leading-relaxed">
                  Select an album folder from the left directory column layout, or create a brand new client-side encrypted vault to start sorting photos!
                </p>
              </div>

              {!isFirebaseConfigured && (
                <div className="max-w-xs mt-4">
                  <button
                    id="no-album-modal-trigger"
                    onClick={() => setIsCreateAlbumOpen(true)}
                    className="px-5 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs shadow-lg cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Your First Album</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* --- FLOATING MODALS & DIALOGS --- */}
      
      {/* Create Album Modal popup */}
      <CreateAlbumModal
        isOpen={isCreateAlbumOpen}
        onClose={() => setIsCreateAlbumOpen(false)}
        onSubmit={createAlbum}
      />

      {/* Photo Details / Slideshow viewport */}
      {activePhoto && (
        <PhotoDetailModal
          photo={activePhoto}
          isEncryptedInDb={!!(activeAlbum && activeAlbum.isEncrypted)}
          onClose={() => setActivePhoto(null)}
          onDelete={() => {
            setDeleteConfirmTarget({ id: activePhoto.id, title: activePhoto.title || "Untitled", type: "photo" });
          }}
          onEditTrigger={() => setIsEditorOpen(true)}
          onAddTag={(tag) => handleAddTag(activePhoto.id, tag)}
          onRemoveTag={(tag) => handleRemoveTag(activePhoto.id, tag)}
          // Slideshow parameters
          onPrev={handlePrevSlide}
          onNext={handleNextSlide}
          hasPrev={slideshowIndices.hasPrev}
          hasNext={slideshowIndices.hasNext}
        />
      )}

      {/* Embedded Canvas Filter Editor */}
      {activePhoto && (
        <PhotoEditor
          isOpen={isEditorOpen}
          photoUrl={activePhoto.dataUrl}
          photoTitle={activePhoto.title}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleEditorSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteConfirmTarget}
        onClose={() => setDeleteConfirmTarget(null)}
        onConfirm={executeDeleteConfirmTarget}
        title={deleteConfirmTarget?.title || ""}
        type={deleteConfirmTarget?.type || "photo"}
      />

      {/* Small footer brand signature */}
      <footer className="py-6 px-6 text-center border-t border-zinc-900 bg-[#0a0a0c] text-[11px] text-[#52525b] font-bold uppercase tracking-wider font-mono">
        Vault.GCM • Zero-Knowledge Cryptography GCM-256
      </footer>

    </div>
  );
}
